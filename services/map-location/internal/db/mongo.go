package db
 
import (
    "context"
    "time"
    "go.mongodb.org/mongo-driver/v2/bson"
    "go.mongodb.org/mongo-driver/v2/mongo"
    "go.mongodb.org/mongo-driver/v2/mongo/options"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/config"
)
 
var Client *mongo.Client
var DB     *mongo.Database
 
const (
    CollCheckIns  = "checkins"
    CollWaypoints = "waypoints"
    CollGeofences = "geofences"
)
 
func Connect(logger *zap.Logger) error {
    ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
    defer cancel()
 
    client, err := mongo.Connect(options.Client().ApplyURI(config.C.MongoURI))
    if err != nil { return err }
 
    if err = client.Ping(ctx, nil); err != nil { return err }
 
    Client = client
    DB     = client.Database("tripparty")
    logger.Info("✅ MongoDB connected")
 
    return createIndexes(ctx, logger)
}
 
func createIndexes(ctx context.Context, logger *zap.Logger) error {
    // ── checkins: 2dsphere + trip_id+created_at ────────────────────────────
    _, err := DB.Collection(CollCheckIns).Indexes().CreateMany(ctx, []mongo.IndexModel{
        { Keys: bson.D{{Key: "location", Value: "2dsphere"}} },
        { Keys: bson.D{{Key: "trip_id", Value: 1}, {Key: "created_at", Value: -1}} },
        { Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}} },
    })
    if err != nil { return err }
 
    // ── waypoints: trip_id+order compound ─────────────────────────────────
    _, err = DB.Collection(CollWaypoints).Indexes().CreateMany(ctx, []mongo.IndexModel{
        { Keys: bson.D{{Key: "trip_id", Value: 1}, {Key: "order", Value: 1}} },
        { Keys: bson.D{{Key: "location", Value: "2dsphere"}} },
    })
    if err != nil { return err }
 
    // ── geofences: center 2dsphere + vendor_id ────────────────────────────
    _, err = DB.Collection(CollGeofences).Indexes().CreateMany(ctx, []mongo.IndexModel{
        { Keys: bson.D{{Key: "center", Value: "2dsphere"}} },
        { Keys: bson.D{{Key: "vendor_id", Value: 1}} },
        { Keys: bson.D{{Key: "is_active", Value: 1}} },
    })
    if err != nil { return err }
 
    logger.Info("✅ MongoDB indexes created")
    return nil
}
 
func Disconnect(logger *zap.Logger) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    if err := Client.Disconnect(ctx); err != nil {
        logger.Error("MongoDB disconnect error", zap.Error(err))
    }
    logger.Info("MongoDB disconnected gracefully")
}
