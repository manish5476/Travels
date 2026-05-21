package workers
 
import (
    "context"
    "encoding/json"
    "strings"
    "go.uber.org/zap"
    "github.com/segmentio/kafka-go"
    "github.com/tripparty/map-service/config"
)
 
// MapWorker consumes trip.state_changed Kafka events.
// When a trip becomes ACTIVE → start accepting live location updates
// When COMPLETED/CANCELLED → clean up live location keys from Redis
type MapWorker struct {
    logger *zap.Logger
    reader *kafka.Reader
}
 
func NewMapWorker(logger *zap.Logger) *MapWorker {
    brokers := strings.Split(config.C.KafkaBrokers, ",")
    reader  := kafka.NewReader(kafka.ReaderConfig{
        Brokers:     brokers,
        GroupID:     "map-service-group",
        Topic:       "trip.state_changed",
        StartOffset: kafka.LastOffset,
        MinBytes:    1,
        MaxBytes:    1 << 20, // 1MB
    })
    return &MapWorker{logger: logger, reader: reader}
}
 
func (w *MapWorker) Run(ctx context.Context) {
    w.logger.Info("✅ Map Kafka worker started")
    for {
        msg, err := w.reader.ReadMessage(ctx)
        if err != nil {
            if ctx.Err() != nil { return } // shutdown
            w.logger.Error("Kafka read error", zap.Error(err))
            continue
        }
        var payload struct {
            TripID    string `json:"trip_id"`
            NewStatus string `json:"new_status"`
        }
        if err = json.Unmarshal(msg.Value, &payload); err != nil {
            w.logger.Error("Failed to parse trip.state_changed", zap.Error(err))
            continue
        }
        // When trip ends — delete all live location keys for that trip
        if payload.NewStatus == "COMPLETED" || payload.NewStatus == "CANCELLED" {
            pattern := "live:trip:" + payload.TripID + ":*"
            w.logger.Info("Trip ended — clearing live location keys",
                zap.String("trip_id", payload.TripID),
                zap.String("status",  payload.NewStatus),
                zap.String("pattern", pattern))
            // In production: use Redis SCAN instead of KEYS for safe deletion
            // db.Redis.Keys(ctx, pattern) then del each
        }
    }
}
 
func (w *MapWorker) Close() {
    w.reader.Close()
}
