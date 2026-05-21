package kafka
 
import (
    "context"
    "encoding/json"
    "strings"
    "time"
    "github.com/segmentio/kafka-go"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/config"
)
 
var writer *kafka.Writer
 
func Connect(logger *zap.Logger) {
    brokers := strings.Split(config.C.KafkaBrokers, ",")
    writer = &kafka.Writer{
        Addr:         kafka.TCP(brokers...),
        Balancer:     &kafka.LeastBytes{},
        RequiredAcks: kafka.RequireOne,
        Compression:  kafka.Gzip,
        WriteTimeout: 5 * time.Second,
        MaxAttempts:  3,
    }
    logger.Info("✅ Kafka writer ready")
}
 
// Publish sends a Kafka message with the given topic, key, and payload struct.
func Publish(ctx context.Context, topic, key string, payload any) error {
    if writer == nil { return nil }
 
    b, err := json.Marshal(payload)
    if err != nil { return err }
 
    return writer.WriteMessages(ctx, kafka.Message{
        Topic: topic,
        Key:   []byte(key),
        Value: b,
    })
}
 
func Disconnect(logger *zap.Logger) {
    if writer != nil {
        if err := writer.Close(); err != nil {
            logger.Error("Kafka writer close error", zap.Error(err))
        }
    }
}
