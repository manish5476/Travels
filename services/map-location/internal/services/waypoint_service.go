package services
 
import (
    "context"
    "fmt"
    "time"
    "go.mongodb.org/mongo-driver/v2/bson"
    "go.mongodb.org/mongo-driver/v2/bson/primitive"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/db"
    "github.com/tripparty/map-service/models"
)
 
type WaypointService struct { logger *zap.Logger }
func NewWaypointService(l *zap.Logger) *WaypointService { return &WaypointService{logger: l} }
 
func (s *WaypointService) Add(ctx context.Context, wp *models.Waypoint) (*models.Waypoint, error) {
    wp.CreatedAt = time.Now().UTC()
    wp.UpdatedAt = time.Now().UTC()
    res, err := db.DB.Collection(db.CollWaypoints).InsertOne(ctx, wp)
    if err != nil { return nil, fmt.Errorf("insert waypoint: %w", err) }
    wp.ID = res.InsertedID.(primitive.ObjectID)
    s.logger.Info("Waypoint added", zap.String("trip_id", wp.TripID), zap.Int("order", wp.Order))
    return wp, nil
}
 
func (s *WaypointService) GetByTrip(ctx context.Context, tripID string) ([]models.Waypoint, error) {
    cur, err := db.DB.Collection(db.CollWaypoints).Find(ctx,
        bson.M{"trip_id": tripID},
        findOpts().SetSort(bson.D{{Key: "order", Value: 1}}))
    if err != nil { return nil, err }
    defer cur.Close(ctx)
    var wps []models.Waypoint
    return wps, cur.All(ctx, &wps)
}
 
func (s *WaypointService) Reorder(ctx context.Context, tripID string, orderedIDs []string) error {
    for i, id := range orderedIDs {
        oid, err := primitive.ObjectIDFromHex(id)
        if err != nil { return err }
        _, err = db.DB.Collection(db.CollWaypoints).UpdateOne(ctx,
            bson.M{"_id": oid, "trip_id": tripID},
            bson.M{"$set": bson.M{"order": i, "updated_at": time.Now().UTC()}})
        if err != nil { return err }
    }
    return nil
}
 
func (s *WaypointService) MarkVisited(ctx context.Context, waypointID, tripID string) error {
    oid, err := primitive.ObjectIDFromHex(waypointID)
    if err != nil { return err }
    _, err = db.DB.Collection(db.CollWaypoints).UpdateOne(ctx,
        bson.M{"_id": oid, "trip_id": tripID},
        bson.M{"$set": bson.M{
            "is_visited":    true,
            "actual_arrival": time.Now().UTC(),
            "updated_at":    time.Now().UTC(),
        }})
    return err
}
 
func (s *WaypointService) Delete(ctx context.Context, waypointID, tripID string) error {
    oid, err := primitive.ObjectIDFromHex(waypointID)
    if err != nil { return err }
    _, err = db.DB.Collection(db.CollWaypoints).DeleteOne(ctx,
        bson.M{"_id": oid, "trip_id": tripID})
    return err
}
 
func findOpts() *findOptions { return &findOptions{} }
type findOptions struct{ sort bson.D; limit int64 }
func (o *findOptions) SetSort(s bson.D) *findOptions  { o.sort = s; return o }
