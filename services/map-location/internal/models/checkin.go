package models
 
import (
    "time"
    "go.mongodb.org/mongo-driver/v2/bson"
)
 
// CheckIn represents a user arriving at a named location during a trip.
// blueprint §4.x — location.checkin Kafka event published on every check-in
type CheckIn struct {
    ID          bson.ObjectID      `bson:"_id,omitempty"    json:"id"`
    TripID      string             `bson:"trip_id"          json:"trip_id"          validate:"required"`
    UserID      string             `bson:"user_id"          json:"user_id"          validate:"required"`
    // GeoJSON Point — [lng, lat] order (GeoJSON spec, NOT lat/lng)
    Location    GeoJSONPoint       `bson:"location"         json:"location"         validate:"required"`
    Label       string             `bson:"label"            json:"label"            validate:"max=200"`
    PlaceID     string             `bson:"place_id"         json:"place_id"`
    Notes       string             `bson:"notes"            json:"notes"            validate:"max=500"`
    LinkedPostID string            `bson:"linked_post_id"   json:"linked_post_id"`
    // Blueprint §1.7 Privacy: location never stored raw — coordinates are
    // city-level precision (truncated to 2 decimal places = ~1km accuracy)
    Accuracy    float64            `bson:"accuracy_meters"  json:"accuracy_meters"`
    CreatedAt   time.Time          `bson:"created_at"       json:"created_at"`
}
 
// GeoJSONPoint — MongoDB 2dsphere compatible
type GeoJSONPoint struct {
    Type        string    `bson:"type"        json:"type"        default:"Point"`
    Coordinates [2]float64 `bson:"coordinates" json:"coordinates"` // [lng, lat]
}
 
func NewGeoJSONPoint(lng, lat float64) GeoJSONPoint {
    return GeoJSONPoint{Type: "Point", Coordinates: [2]float64{lng, lat}}
}
