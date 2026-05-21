package models
 
import (
    "time"
    "go.mongodb.org/mongo-driver/v2/bson/primitive"
)
 
// Geofence defines a circular region around a vendor or point of interest.
// When a user enters the radius, vendor.geo_triggered Kafka event fires.
// Blueprint §12.2: only paid vendor tiers (basic+) get geo-triggers.
type Geofence struct {
    ID          primitive.ObjectID `bson:"_id,omitempty"  json:"id"`
    VendorID    string             `bson:"vendor_id"      json:"vendor_id"    validate:"required"`
    Center      GeoJSONPoint       `bson:"center"         json:"center"       validate:"required"`
    RadiusKm    float64            `bson:"radius_km"      json:"radius_km"    validate:"min=0.1,max=50"`
    Label       string             `bson:"label"          json:"label"        validate:"max=200"`
    // Trigger payload sent to Notification Service via Kafka
    TriggerMsg  string             `bson:"trigger_msg"    json:"trigger_msg"  validate:"max=160"`
    IsActive    bool               `bson:"is_active"      json:"is_active"`
    TriggeredBy []string           `bson:"triggered_by"   json:"triggered_by"` // user_ids who triggered (dedup window: 24h)
    CreatedAt   time.Time          `bson:"created_at"     json:"created_at"`
}
 
// LiveLocation is a short-lived Redis-only structure — NOT stored in MongoDB.
// Blueprint §1.3: Live Location = AP — eventual consistency is fine.
// Key: live:loc:{trip_id}:{user_id}  TTL: 30s (config.LiveLocationTTLSec)
type LiveLocation struct {
    UserID    string    `json:"user_id"`
    TripID    string    `json:"trip_id"`
    Lat       float64   `json:"lat"`
    Lng       float64   `json:"lng"`
    Accuracy  float64   `json:"accuracy_meters"`
    Bearing   float64   `json:"bearing"`    // degrees 0-360
    Speed     float64   `json:"speed_kmh"`
    UpdatedAt int64     `json:"updated_at"` // Unix ms
}
 
// RouteCache stores OSRM route responses in Redis to avoid redundant API calls
type RouteCache struct {
    Distance float64   `json:"distance_km"`
    Duration float64   `json:"duration_min"`
    Geometry [][]float64 `json:"geometry"` // [[lng,lat],...] decoded polyline
    Steps    []RouteStep `json:"steps"`
}
 
type RouteStep struct {
    Instruction string    `json:"instruction"`
    Distance    float64   `json:"distance_km"`
    Duration    float64   `json:"duration_min"`
    Maneuver    string    `json:"maneuver"`
}
