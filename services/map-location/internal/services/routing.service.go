package services
 
import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/db"
    "github.com/tripparty/map-service/models"
)
 
// RouteService computes routes using OSRM (Open Source Routing Machine).
// OSRM is self-hosted — no per-call cost, no Google Maps API dependency.
// Responses are cached in Redis for 1 hour (routes don't change frequently).
type RouteService struct {
    logger    *zap.Logger
    osrmBase  string
    httpClient *http.Client
}
 
func NewRouteService(l *zap.Logger, osrmBase string) *RouteService {
    return &RouteService{
        logger:   l,
        osrmBase: osrmBase,
        httpClient: &http.Client{Timeout: 10 * time.Second},
    }
}
 
// ComputeRoute gets walking/driving/cycling route between two points.
// Checks Redis cache first — OSRM called only on cache miss.
func (s *RouteService) ComputeRoute(ctx context.Context,
    fromLng, fromLat, toLng, toLat float64, mode string) (*models.RouteCache, error) {
 
    // Cache key — rounded to 3dp (~100m precision) to maximise cache hits
    cacheKey := fmt.Sprintf("route:%s:%.3f,%.3f:%.3f,%.3f",
        mode, fromLng, fromLat, toLng, toLat)
 
    // ── Cache hit ─────────────────────────────────────────────────────────
    cached, err := db.Redis.Get(ctx, cacheKey).Bytes()
    if err == nil {
        var route models.RouteCache
        if json.Unmarshal(cached, &route) == nil {
            s.logger.Debug("Route cache hit", zap.String("key", cacheKey))
            return &route, nil
        }
    }
 
    // ── OSRM call ─────────────────────────────────────────────────────────
    // OSRM profile mapping: driving → car, cycling → bike, walking → foot
    profile := map[string]string{
        "driving": "car", "cycling": "bike", "walking": "foot", "transit": "car",
    }[mode]
    if profile == "" { profile = "car" }
 
    url := fmt.Sprintf("%s/route/v1/%s/%.6f,%.6f;%.6f,%.6f?steps=true&geometries=geojson&overview=full",
        s.osrmBase, profile, fromLng, fromLat, toLng, toLat)
 
    resp, err := s.httpClient.Get(url)
    if err != nil { return nil, fmt.Errorf("OSRM request failed: %w", err) }
    defer resp.Body.Close()
 
    body, _ := io.ReadAll(resp.Body)
    var osrmResp struct {
        Routes []struct {
            Distance float64 `json:"distance"` // metres
            Duration float64 `json:"duration"` // seconds
            Geometry struct {
                Coordinates [][]float64 `json:"coordinates"`
            } `json:"geometry"`
            Legs []struct {
                Steps []struct {
                    Maneuver struct{ Type string `json:"type"` } `json:"maneuver"`
                    Name     string  `json:"name"`
                    Distance float64 `json:"distance"`
                    Duration float64 `json:"duration"`
                } `json:"steps"`
            } `json:"legs"`
        } `json:"routes"`
    }
 
    if err = json.Unmarshal(body, &osrmResp); err != nil || len(osrmResp.Routes) == 0 {
        return nil, fmt.Errorf("OSRM parse failed or no route found")
    }
 
    r := osrmResp.Routes[0]
    route := &models.RouteCache{
        Distance: r.Distance / 1000, // metres → km
        Duration: r.Duration / 60,   // seconds → minutes
        Geometry: r.Geometry.Coordinates,
    }
    if len(r.Legs) > 0 {
        for _, step := range r.Legs[0].Steps {
            route.Steps = append(route.Steps, models.RouteStep{
                Instruction: step.Name,
                Distance:    step.Distance / 1000,
                Duration:    step.Duration / 60,
                Maneuver:    step.Maneuver.Type,
            })
        }
    }
 
    // ── Cache for 1 hour ──────────────────────────────────────────────────
    if b, err := json.Marshal(route); err == nil {
        db.Redis.Set(ctx, cacheKey, b, time.Hour)
    }
 
    return route, nil
}
 
// GetDistance returns driving distance between two points (lightweight, no steps)
func (s *RouteService) GetDistance(ctx context.Context, fromLng, fromLat, toLng, toLat float64) (float64, error) {
    route, err := s.ComputeRoute(ctx, fromLng, fromLat, toLng, toLat, "driving")
    if err != nil { return 0, err }
    return route.Distance, nil
}
