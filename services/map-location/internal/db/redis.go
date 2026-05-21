package db
 
import (
    "context"
    "github.com/redis/go-redis/v9"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/config"
)
 
var Redis *redis.Client
 
func ConnectRedis(logger *zap.Logger) error {
    opt, err := redis.ParseURL(config.C.RedisURL)
    if err != nil { return err }
 
    Redis = redis.NewClient(opt)
 
    ctx := context.Background()
    if err = Redis.Ping(ctx).Err(); err != nil { return err }
 
    logger.Info("✅ Redis connected")
    return nil
}
 
func DisconnectRedis(logger *zap.Logger) {
    if err := Redis.Close(); err != nil {
        logger.Error("Redis close error", zap.Error(err))
    }
    logger.Info("Redis disconnected gracefully")
}
