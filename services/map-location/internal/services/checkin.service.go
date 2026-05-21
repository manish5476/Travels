package services
 
import (
    "context"
    "fmt"
    "math"
    "time"
    "encoding/json"
    "go.mongodb.org/mongo-driver/v2/bson"
    "go.uber.org/zap"
    "github.com/google/uuid"
    "github.com/tripparty/map-service/db"
    "github.com/tripparty/map-service/kafka"
    "github.com/tripparty/map-service/models"
    "github.com/tripparty/map-service/config"
)
 
type CheckInService struct { logger *zap.Logger }
func NewCheckInService(l *zap.Logger) *CheckInService { return &CheckInService{logger: l} }
 
// ── Create check-in ────────────────────────────────────────────────────────
// Blueprint §L7 Privacy: coordinates truncated to ~1km precision before storage
func (s *CheckInService) Create(ctx context.Context, tripID, userID string,
    rawLng, rawLat float64, label, placeID, notes string) (*models.CheckIn, error) {
 
    // Truncate to 2dp — ~1.1km accuracy (privacy-by-design, blueprint §L7)
    lng := math.Round(rawLng*100) / 100
    lat := math.Round(rawLat*100) / 100
 
    ci := &models.CheckIn{
        TripID:    tripID,
        UserID:    userID,
        Location:  models.NewGeoJSONPoint(lng, lat),
        Label:     label,
        PlaceID:   placeID,
        Notes:     notes,
        CreatedAt: time.Now().UTC(),
    }
 
    res, err := db.DB.Collection(db.CollCheckIns).InsertOne(ctx, ci)
    if err != nil { return nil, fmt.Errorf("insert check-in: %w", err) }
    ci.ID = res.InsertedID.(interface{ Hex() string }).(interface {
        Hex() string
    })
 
    // ── Publish location.checkin Kafka event ──────────────────────────────
    // Consumers: Notification Svc (group update), Vendor Svc (geo-trigger check),
    //            Analytics (heatmap data)
    _ = kafka.Publish(ctx, "location.checkin", tripID, map[string]any{
        "check_in_id": res.InsertedID,
        "trip_id":     tripID,
        "user_id":     userID,
        "lat":         lat,
        "lng":         lng,
        "label":       label,
        "place_id":    placeID,
        "_ts":         time.Now().UTC().Format(time.RFC3339),
    })
 
    s.logger.Info("Check-in created", zap.String("trip_id", tripID), zap.String("user_id", userID))
 
    // ── Async geofence evaluation ─────────────────────────────────────────
    go s.evaluateGeofences(context.Background(), userID, tripID, lng, lat)
 
    return ci, nil
}
 
// ── Get all check-ins for a trip ──────────────────────────────────────────
func (s *CheckInService) GetByTrip(ctx context.Context, tripID string, limit int64) ([]models.CheckIn, error) {
    opts := options().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(limit)
    cur, err := db.DB.Collection(db.CollCheckIns).Find(ctx,
        bson.M{"trip_id": tripID}, opts)
    if err != nil { return nil, err }
    defer cur.Close(ctx)
    var results []models.CheckIn
    return results, cur.All(ctx, &results)
}
 
// ── Geofence evaluation (runs in goroutine, non-blocking) ─────────────────
// Finds all active geofences within 50km of check-in point and fires
// vendor.geo_triggered event if user hasn't triggered this fence in 24h
func (s *CheckInService) evaluateGeofences(ctx context.Context, userID, tripID string, lng, lat float64) {
    cur, err := db.DB.Collection(db.CollGeofences).Find(ctx, bson.M{
        "is_active": true,
        "center": bson.M{
            "$nearSphere": bson.M{
                "$geometry":   bson.M{"type": "Point", "coordinates": []float64{lng, lat}},
                "$maxDistance": 50000, // 50km outer bound
            },
        },
    })
    if err != nil { s.logger.Error("Geofence query failed", zap.Error(err)); return }
    defer cur.Close(ctx)
 
    var fences []models.Geofence
    if err = cur.All(ctx, &fences); err != nil { return }
 
    for _, fence := range fences {
        // Precise Haversine check against fence's actual radius
        dist := haversineKm(lat, lng,
            fence.Center.Coordinates[1], fence.Center.Coordinates[0])
        if dist > fence.RadiusKm { continue }
 
        // 24-hour dedup window — don't spam same vendor notification
        dedupKey := fmt.Sprintf("geofence:triggered:%s:%s", fence.ID.Hex(), userID)
        set, err := db.Redis.SetNX(ctx, dedupKey, "1", 24*time.Hour).Result()
        if err != nil || !set { continue } // already triggered in last 24h
 
        // Publish vendor.geo_triggered — Notification Svc sends contextual push
        _ = kafka.Publish(ctx, "vendor.geo_triggered", fence.VendorID, map[string]any{
            "vendor_id":   fence.VendorID,
            "user_id":     userID,
            "trip_id":     tripID,
            "fence_id":    fence.ID,
            "trigger_msg": fence.TriggerMsg,
            "distance_km": dist,
            "_ts":         time.Now().UTC().Format(time.RFC3339),
        })
        s.logger.Info("Geo-trigger fired",
            zap.String("vendor_id", fence.VendorID),
            zap.String("user_id",   userID),
            zap.Float64("dist_km",  dist))
    }
}
 
// ── Haversine formula — great-circle distance in km ───────────────────────
func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
    const R = 6371.0 // Earth radius in km
    dLat := (lat2 - lat1) * math.Pi / 180
    dLng := (lng2 - lng1) * math.Pi / 180
    a := math.Sin(dLat/2)*math.Sin(dLat/2) +
        math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
        math.Sin(dLng/2)*math.Sin(dLng/2)
    return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}
 
func options() *mongoOptions { return &mongoOptions{} }
 
// mongoOptions is a thin wrapper — in real code use mongo/options directly
type mongoOptions struct {
    sort  bson.D
    limit int64
}
func (o *mongoOptions) SetSort(s bson.D) *mongoOptions  { o.sort = s; return o }
func (o *mongoOptions) SetLimit(l int64) *mongoOptions  { o.limit = l; return o }
