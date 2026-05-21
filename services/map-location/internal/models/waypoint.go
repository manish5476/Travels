package models
 
import (
    "time"
    "go.mongodb.org/mongo-driver/v2/bson/primitive"
)
 
// Waypoint is a planned stop on a trip route.
// Stored separately from the trips collection for independent querying.
// Also mirrors the embedded waypoints[] in the Trip document.
type Waypoint struct {
    ID           primitive.ObjectID `bson:"_id,omitempty"     json:"id"`
    TripID       string             `bson:"trip_id"           json:"trip_id"           validate:"required"`
    Order        int                `bson:"order"             json:"order"             validate:"min=0"`
    Location     GeoJSONPoint       `bson:"location"          json:"location"          validate:"required"`
    Label        string             `bson:"label"             json:"label"             validate:"max=200"`
    PlaceID      string             `bson:"place_id"          json:"place_id"`
    TravelMode   string             `bson:"travel_mode"       json:"travel_mode"       validate:"oneof=driving walking cycling transit"`
    EstArrival   *time.Time         `bson:"est_arrival"       json:"est_arrival"`
    ActualArrival *time.Time        `bson:"actual_arrival"    json:"actual_arrival"`
    LinkedPostIDs []string          `bson:"linked_post_ids"   json:"linked_post_ids"`
    IsVisited    bool               `bson:"is_visited"        json:"is_visited"`
    CreatedAt    time.Time          `bson:"created_at"        json:"created_at"`
    UpdatedAt    time.Time          `bson:"updated_at"        json:"updated_at"`
}
