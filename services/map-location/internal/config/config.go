package config
 
import (
    "github.com/kelseyhightower/envconfig"
    "go.uber.org/zap"
)
 
// Config holds all env vars — validated at startup via envconfig tags.
// App exits with clear error message if any required field is missing.
type Config struct {
    NodeEnv                string `envconfig:"NODE_ENV"         default:"development"`
    Port                   string `envconfig:"PORT"             default:"8010"`
    LogLevel               string `envconfig:"LOG_LEVEL"        default:"info"`
    ServiceName            string `envconfig:"SERVICE_NAME"     default:"map-service"`
    MongoURI               string `envconfig:"MONGODB_URI"      required:"true"`
    RedisURL               string `envconfig:"REDIS_URL"        required:"true"`
    KafkaBrokers           string `envconfig:"KAFKA_BROKERS"    required:"true"`
    JWTPublicKey           string `envconfig:"JWT_PUBLIC_KEY"   required:"true"`
    InternalSecret         string `envconfig:"INTERNAL_SECRET"  required:"true"`
    TripServiceURL         string `envconfig:"TRIP_SERVICE_URL" default:"http://trip:8009"`
    // Blueprint §1.3: Live Location = AP — 5-second lag acceptable
    LiveLocationTTLSec     int    `envconfig:"LIVE_LOCATION_TTL_SEC" default:"30"`
    GeofenceCheckIntervalSec int  `envconfig:"GEOFENCE_CHECK_INTERVAL_SEC" default:"15"`
}
 
var C Config
 
func Load() {
    if err := envconfig.Process("", &C); err != nil {
        // Fatal — cannot start without required config
        panic("❌ Config error: " + err.Error())
    }
}
 
// NewLogger creates a structured Zap logger (production = JSON, dev = console)
func NewLogger() *zap.Logger {
    var logger *zap.Logger
    var err error
    if C.NodeEnv == "production" {
        logger, err = zap.NewProduction()
    } else {
        logger, err = zap.NewDevelopment()
    }
    if err != nil { panic("❌ Logger init failed: " + err.Error()) }
    return logger
}
