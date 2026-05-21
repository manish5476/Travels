package main
 
import (
    "context"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"
    "go.uber.org/zap"
    "github.com/tripparty/map-service/config"
    "github.com/tripparty/map-service/db"
    "github.com/tripparty/map-service/handlers"
    "github.com/tripparty/map-service/kafka"
    "github.com/tripparty/map-service/router"
    "github.com/tripparty/map-service/services"
    "github.com/tripparty/map-service/workers"
)
 
func main() {
    // ── 1. Load & validate config ─────────────────────────────────────────
    config.Load()
    logger := config.NewLogger()
    defer logger.Sync()
 
    logger.Info("Starting Map & Location Service",
        zap.String("port",    config.C.Port),
        zap.String("env",     config.C.NodeEnv),
        zap.String("service", config.C.ServiceName))
 
    // ── 2. Connect infrastructure ────────────────────────────────────────
    if err := db.Connect(logger); err != nil {
        logger.Fatal("❌ MongoDB connect failed", zap.Error(err))
    }
    if err := db.ConnectRedis(logger); err != nil {
        logger.Fatal("❌ Redis connect failed", zap.Error(err))
    }
    kafka.Connect(logger)
 
    // ── 3. Wire services ─────────────────────────────────────────────────
    checkInSvc     := services.NewCheckInService(logger)
    liveLocSvc     := services.NewLiveLocationService(logger)
    waypointSvc    := services.NewWaypointService(logger)
    routeSvc       := services.NewRouteService(logger, "http://osrm:5000")
    geofenceSvc    := services.NewGeofenceService(logger)
 
    // ── 4. Wire handlers ─────────────────────────────────────────────────
    h := handlers.New(checkInSvc, liveLocSvc, waypointSvc, routeSvc, geofenceSvc, logger)
 
    // ── 5. Start Kafka worker ─────────────────────────────────────────────
    worker := workers.NewMapWorker(logger)
    ctx, cancel := context.WithCancel(context.Background())
    go worker.Run(ctx)
 
    // ── 6. Start HTTP server ──────────────────────────────────────────────
    srv := &http.Server{
        Addr:         ":" + config.C.Port,
        Handler:      router.Setup(h),
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }
 
    go func() {
        logger.Info("✅ Map Service listening", zap.String("port", config.C.Port))
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            logger.Fatal("Server error", zap.Error(err))
        }
    }()
 
    // ── 7. Graceful shutdown ──────────────────────────────────────────────
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
    sig := <-quit
    logger.Info("Shutdown signal received", zap.String("signal", sig.String()))
 
    cancel() // stop Kafka worker
    worker.Close()
 
    shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer shutCancel()
    if err := srv.Shutdown(shutCtx); err != nil {
        logger.Error("HTTP shutdown error", zap.Error(err))
    }
 
    kafka.Disconnect(logger)
    db.Disconnect(logger)
    db.DisconnectRedis(logger)
    logger.Info("✅ Map Service shut down cleanly")
}
