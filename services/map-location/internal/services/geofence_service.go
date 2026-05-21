package services
 
import (
    "context"
    "time"
    "go.mongodb.org/mongo-driver/v2/bson"
    "go.mongodb.org/mongo-driver/v2/bson/primitive"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/db"
    "github.com/tripparty/map-service/models"
)
 
type GeofenceService struct { logger *zap.Logger }
func NewGeofenceService(l *zap.Logger) *GeofenceService { return &GeofenceService{logger: l} }
 
// Create a geofence around a vendor location (called by Vendor Service via internal API)
func (s *GeofenceService) Create(ctx context.Context, g *models.Geofence) (*models.Geofence, error) {
    g.IsActive  = true
    g.CreatedAt = time.Now().UTC()
    res, err := db.DB.Collection(db.CollGeofences).InsertOne(ctx, g)
    if err != nil { return nil, err }
    g.ID = res.InsertedID.(primitive.ObjectID)
    s.logger.Info("Geofence created",
        zap.String("vendor_id", g.VendorID),
        zap.Float64("radius_km", g.RadiusKm))
    return g, nil
}
 
// GetByVendor returns all geofences for a vendor
func (s *GeofenceService) GetByVendor(ctx context.Context, vendorID string) ([]models.Geofence, error) {
    cur, err := db.DB.Collection(db.CollGeofences).Find(ctx, bson.M{"vendor_id": vendorID})
    if err != nil { return nil, err }
    defer cur.Close(ctx)
    var fences []models.Geofence
    return fences, cur.All(ctx, &fences)
}
 
// ToggleActive enables or disables a geofence
func (s *GeofenceService) ToggleActive(ctx context.Context, fenceID string, active bool) error {
    oid, err := primitive.ObjectIDFromHex(fenceID)
    if err != nil { return err }
    _, err = db.DB.Collection(db.CollGeofences).UpdateOne(ctx,
        bson.M{"_id": oid},
        bson.M{"$set": bson.M{"is_active": active}})
    return err
}
 
// Delete permanently removes a geofence
func (s *GeofenceService) Delete(ctx context.Context, fenceID string) error {
    oid, err := primitive.ObjectIDFromHex(fenceID)
    if err != nil { return err }
    _, err = db.DB.Collection(db.CollGeofences).DeleteOne(ctx, bson.M{"_id": oid})
    return err
}
