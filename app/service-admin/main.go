package main

import (
	"app/pkg"
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"service-admin/auth"
	"service-admin/config"
	"service-admin/grpc"
	"service-admin/pubsub"
	"service-admin/rest"
	"service-admin/sse"
)

func main() {
	// Load the configuration
	cfg := config.LoadConfig()

	// Set up the logger
	pkg.InitLogger(cfg.LogLevel)

	// Connect to NATS
	nc := pubsub.ConnectNATS(cfg.NATSURL)
	// Create Event Broker
	broker, err := pubsub.NewEventBroker(nc, "notifications")
	if err != nil {
		panic(err)
	}
	slog.Info("NATS connection established", "url", cfg.NATSURL)

	// Create gRPC connection
	conn, err := grpc.NewConn(cfg)
	if err != nil {
		panic(err)
	}
	defer conn.Close()
	slog.Info("gRPC connection established", "address", cfg.CoreURI)

	// Set up REST handlers
	restHandler := setupRESTHandlers(cfg, conn, broker)
	// Run the REST server
	restServer := rest.Run(restHandler)

	// Set up SSE handler
	sseHandler := setupSSEHandler(cfg, broker)
	// Run the SSE server
	sseServer := sse.Run(sseHandler)

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down servers...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := restServer.Shutdown(ctx); err != nil {
		slog.Error("REST server forced to shutdown", "error", err)
	}
	if err := sseServer.Shutdown(ctx); err != nil {
		slog.Error("SSE server forced to shutdown", "error", err)
	}

	slog.Info("Servers stopped gracefully")
}

func setupRESTHandlers(cfg *config.Config, conn *grpc.Conn, broker *pubsub.EventBroker) *rest.Handler {
	authService := auth.NewService(cfg)
	handler := rest.NewHandler(cfg, conn, broker, authService)
	return handler
}

func setupSSEHandler(cfg *config.Config, broker *pubsub.EventBroker) *sse.Handler {
	authService := auth.NewService(cfg)
	handler := sse.NewHandler(cfg, broker, authService)
	return handler
}
