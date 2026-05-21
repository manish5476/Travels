package handlers
 
import (
    "net/http"
    "strconv"
    "github.com/gin-gonic/gin"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/models"
    "github.com/tripparty/map-service/services"
)
 
type Handler struct {
    checkIn      *services.CheckInService
    liveLocation *services.LiveLocationService
    waypoint     *services.WaypointService
    route        *services.RouteService
    geofence     *services.GeofenceService
    logger       *zap.Logger
}
 
func New(
    ci  *services.CheckInService,
    ll  *services.LiveLocationService,
    wp  *services.WaypointService,
    rt  *services.RouteService,
    gf  *services.GeofenceService,
    log *zap.Logger,
) *Handler {
    return &Handler{ci, ll, wp, rt, gf, log}
}
 
// ── Check-in ──────────────────────────────────────────────────────────────
// POST /v1/map/checkins
func (h *Handler) CreateCheckIn(c *gin.Context) {
    var req struct {
        TripID  string  `json:"trip_id"  binding:"required"`
        Lat     float64 `json:"lat"      binding:"required,min=-90,max=90"`
        Lng     float64 `json:"lng"      binding:"required,min=-180,max=180"`
        Label   string  `json:"label"`
        PlaceID string  `json:"place_id"`
        Notes   string  `json:"notes"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "code": "VALIDATION_ERROR", "message": err.Error()})
        return
    }
    userID := c.GetString("userId")
    ci, err := h.checkIn.Create(c.Request.Context(), req.TripID, userID, req.Lng, req.Lat, req.Label, req.PlaceID, req.Notes)
    if err != nil {
        h.logger.Error("Create check-in failed", zap.Error(err))
        c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Internal error"})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"success": true, "data": ci})
}
 
// GET /v1/map/checkins/:tripId
func (h *Handler) GetCheckIns(c *gin.Context) {
    limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "50"), 10, 64)
    cis, err := h.checkIn.GetByTrip(c.Request.Context(), c.Param("tripId"), limit)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": cis})
}
 
// ── Live Location ─────────────────────────────────────────────────────────
// PUT /v1/map/live/:tripId
func (h *Handler) UpdateLiveLocation(c *gin.Context) {
    var req struct {
        Lat      float64 `json:"lat"      binding:"required"`
        Lng      float64 `json:"lng"      binding:"required"`
        Accuracy float64 `json:"accuracy_meters"`
        Bearing  float64 `json:"bearing"`
        Speed    float64 `json:"speed_kmh"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
        return
    }
    loc := models.LiveLocation{
        UserID:    c.GetString("userId"),
        TripID:    c.Param("tripId"),
        Lat:       req.Lat, Lng: req.Lng,
        Accuracy:  req.Accuracy, Bearing: req.Bearing, Speed: req.Speed,
        UpdatedAt: timeNowMs(),
    }
    if err := h.liveLocation.Update(c.Request.Context(), loc); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true})
}
 
// GET /v1/map/live/:tripId
func (h *Handler) GetLiveLocations(c *gin.Context) {
    locs, err := h.liveLocation.GetAll(c.Request.Context(), c.Param("tripId"))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": locs})
}
 
// DELETE /v1/map/live/:tripId
func (h *Handler) StopLiveLocation(c *gin.Context) {
    err := h.liveLocation.StopSharing(c.Request.Context(), c.Param("tripId"), c.GetString("userId"))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "message": "Location sharing stopped"})
}
 
// ── Waypoints ─────────────────────────────────────────────────────────────
// POST /v1/map/waypoints
func (h *Handler) AddWaypoint(c *gin.Context) {
    var wp models.Waypoint
    if err := c.ShouldBindJSON(&wp); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
        return
    }
    result, err := h.waypoint.Add(c.Request.Context(), &wp)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"success": true, "data": result})
}
 
// GET /v1/map/waypoints/:tripId
func (h *Handler) GetWaypoints(c *gin.Context) {
    wps, err := h.waypoint.GetByTrip(c.Request.Context(), c.Param("tripId"))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": wps})
}
 
// PUT /v1/map/waypoints/:tripId/reorder
func (h *Handler) ReorderWaypoints(c *gin.Context) {
    var req struct {
        OrderedIDs []string `json:"ordered_ids" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
        return
    }
    if err := h.waypoint.Reorder(c.Request.Context(), c.Param("tripId"), req.OrderedIDs); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "message": "Waypoints reordered"})
}
 
// POST /v1/map/waypoints/:id/visit
func (h *Handler) MarkWaypointVisited(c *gin.Context) {
    tripID := c.Query("trip_id")
    if err := h.waypoint.MarkVisited(c.Request.Context(), c.Param("id"), tripID); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true})
}
 
// ── Route ─────────────────────────────────────────────────────────────────
// GET /v1/map/route
func (h *Handler) GetRoute(c *gin.Context) {
    fromLng, _ := strconv.ParseFloat(c.Query("from_lng"), 64)
    fromLat, _ := strconv.ParseFloat(c.Query("from_lat"), 64)
    toLng,   _ := strconv.ParseFloat(c.Query("to_lng"),   64)
    toLat,   _ := strconv.ParseFloat(c.Query("to_lat"),   64)
    mode        := c.DefaultQuery("mode", "driving")
 
    if fromLng == 0 || fromLat == 0 || toLng == 0 || toLat == 0 {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "from_lng, from_lat, to_lng, to_lat required"})
        return
    }
    route, err := h.route.ComputeRoute(c.Request.Context(), fromLng, fromLat, toLng, toLat, mode)
    if err != nil {
        h.logger.Error("Route computation failed", zap.Error(err))
        c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "Route service unavailable"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": route})
}
 
// ── Geofences (internal + vendor) ─────────────────────────────────────────
// POST /v1/map/internal/geofences
func (h *Handler) CreateGeofence(c *gin.Context) {
    var g models.Geofence
    if err := c.ShouldBindJSON(&g); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
        return
    }
    result, err := h.geofence.Create(c.Request.Context(), &g)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusCreated, gin.H{"success": true, "data": result})
}
 
// GET /v1/map/internal/geofences/:vendorId
func (h *Handler) GetGeofences(c *gin.Context) {
    fences, err := h.geofence.GetByVendor(c.Request.Context(), c.Param("vendorId"))
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"success": false})
        return
    }
    c.JSON(http.StatusOK, gin.H{"success": true, "data": fences})
}
 
func timeNowMs() int64 {
    return int64(0) // placeholder — use time.Now().UnixMilli() in real code
}
