package services
 
import (
    "context"
    "encoding/json"
    "fmt"
    "time"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/db"
    "github.com/tripparty/map-service/models"
    "github.com/tripparty/map-service/config"
)
 
// Blueprint §1.2 Real-Time Clock: live location < 100ms
// Blueprint §1.3 CAP: Live Location = AP — 5-second lag acceptable
// NEVER stored in MongoDB — only in Redis with TTL
 
type LiveLocationService struct { logger *zap.Logger }
func NewLiveLocationService(l *zap.Logger) *LiveLocationService { return &LiveLocationService{logger: l} }
 
func liveKey(tripID, userID string) string {
    return fmt.Sprintf("live:loc:%s:%s", tripID, userID)
}
func tripLiveKey(tripID string) string {
    return fmt.Sprintf("live:trip:%s:members", tripID)
}
 
// UpdateLocation stores user's live location in Redis (TTL = config.LiveLocationTTLSec)
// Called every 5 seconds by the mobile app during an active trip
func (s *LiveLocationService) Update(ctx context.Context, loc models.LiveLocation) error {
    b, err := json.Marshal(loc)
    if err != nil { return err }
 
    ttl := time.Duration(config.C.LiveLocationTTLSec) * time.Second
    key := liveKey(loc.TripID, loc.UserID)
 
    pipe := db.Redis.Pipeline()
    pipe.Set(ctx, key, b, ttl)
    // Track active members set for this trip (used in GetAll)
    pipe.SAdd(ctx, tripLiveKey(loc.TripID), loc.UserID)
    pipe.Expire(ctx, tripLiveKey(loc.TripID), ttl+5*time.Second)
    _, err = pipe.Exec(ctx)
    return err
}
 
// GetAll returns live locations of all active members in a trip
// Uses Redis SET of member IDs to batch-get all locations in one round trip
func (s *LiveLocationService) GetAll(ctx context.Context, tripID string) ([]models.LiveLocation, error) {
    memberIDs, err := db.Redis.SMembers(ctx, tripLiveKey(tripID)).Result()
    if err != nil || len(memberIDs) == 0 { return []models.LiveLocation{}, nil }
 
    // Batch get all locations with MGET
    keys := make([]string, len(memberIDs))
    for i, uid := range memberIDs { keys[i] = liveKey(tripID, uid) }
 
    vals, err := db.Redis.MGet(ctx, keys...).Result()
    if err != nil { return nil, err }
 
    var locations []models.LiveLocation
    for _, v := range vals {
        if v == nil { continue } // TTL expired — member went offline
        var loc models.LiveLocation
        if err = json.Unmarshal([]byte(v.(string)), &loc); err != nil { continue }
        locations = append(locations, loc)
    }
    return locations, nil
}
 
// StopSharing removes user from live tracking (user toggles off location sharing)
func (s *LiveLocationService) StopSharing(ctx context.Context, tripID, userID string) error {
    pipe := db.Redis.Pipeline()
    pipe.Del(ctx, liveKey(tripID, userID))
    pipe.SRem(ctx, tripLiveKey(tripID), userID)
    _, err := pipe.Exec(ctx)
    return err
}
