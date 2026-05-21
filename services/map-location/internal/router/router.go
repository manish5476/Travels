package router
 
import (
    "github.com/gin-gonic/gin"
    "github.com/tripparty/map-service/handlers"
    "github.com/tripparty/map-service/middleware"
)
 
func Setup(h *handlers.Handler) *gin.Engine {
    r := gin.New()
    r.Use(gin.Recovery())
    r.Use(middleware.RequestLogger())
    r.Use(middleware.RequestID())
 
    // ── Health check ────────────────────────────────────────────────────
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok", "service": "map-service"})
    })
 
    v1 := r.Group("/v1/map")
 
    // ── Check-ins (user-authenticated) ──────────────────────────────────
    checkins := v1.Group("/checkins", middleware.AuthMiddleware())
    {
        checkins.POST("",             h.CreateCheckIn)
        checkins.GET("/:tripId",      h.GetCheckIns)
    }
 
    // ── Live location (user-authenticated) ──────────────────────────────
    live := v1.Group("/live", middleware.AuthMiddleware())
    {
        live.PUT("/:tripId",    h.UpdateLiveLocation)
        live.GET("/:tripId",    h.GetLiveLocations)
        live.DELETE("/:tripId", h.StopLiveLocation)
    }
 
    // ── Waypoints (user-authenticated) ──────────────────────────────────
    waypoints := v1.Group("/waypoints", middleware.AuthMiddleware())
    {
        waypoints.POST("",                   h.AddWaypoint)
        waypoints.GET("/:tripId",            h.GetWaypoints)
        waypoints.PUT("/:tripId/reorder",    h.ReorderWaypoints)
        waypoints.POST("/:id/visit",         h.MarkWaypointVisited)
    }
 
    // ── Route (public — no auth needed for directions) ───────────────────
    v1.GET("/route", h.GetRoute)
 
    // ── Internal (service-to-service only) ──────────────────────────────
    internal := v1.Group("/internal", middleware.InternalMiddleware())
    {
        internal.POST("/geofences",            h.CreateGeofence)
        internal.GET("/geofences/:vendorId",   h.GetGeofences)
    }
 
    return r
}
