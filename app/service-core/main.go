package main

import (
	"app/pkg"
	"app/pkg/auth"
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"service-core/config"
	"service-core/domain/billing"
	"service-core/domain/email"
	"service-core/domain/login"
	"service-core/domain/user"
	"service-core/grpc"
	"service-core/rest"
	"service-core/storage"
	"service-core/storage/query"
)

func main() {
	// Load the configuration
	cfg := config.LoadConfig()

	// Set up the logger
	pkg.InitLogger(cfg.LogLevel)

	// Connect to the database
	s, clean, err := storage.NewStorage(cfg)
	defer clean()
	if err != nil {
		slog.Error("Error opening database", "error", err)
		panic(err)
	}
	err = s.Conn.PingContext(context.Background())
	if err != nil {
		slog.Error("Error connecting to database", "error", err)
		panic(err)
	}
	slog.Info("Database connected")

	// Set up the REST handlers
	restHandler := setupRESTHandlers(cfg, s)
	// Run the REST server
	restServer := rest.Run(restHandler)

	// Set up the gRPC handlers
	grpcHandler := setupGRPCHandlers(cfg, s)
	// Run the gRPC server
	grpcServer := grpc.Run(grpcHandler)

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

	grpcServer.GracefulStop()

	slog.Info("Servers stopped gracefully")
}

func setupRESTHandlers(cfg *config.Config, storage *storage.Storage) *rest.Handler {
	store := query.New(storage.Conn)
	authService := auth.NewService()
	emailProvider := email.NewProvider(cfg)
	emailService := email.NewService(cfg, emailProvider)
	loginService := login.NewService(cfg, store, authService, emailService)
	billingService := billing.NewService(cfg, store)

	apiHandler := rest.NewHandler(
		cfg,
		storage,
		authService,
		loginService,
		billingService,
	)
	return apiHandler
}

func setupGRPCHandlers(cfg *config.Config, storage *storage.Storage) *grpc.Handler {
	store := query.New(storage.Conn)
	authService := auth.NewService()
	loginService := login.NewService(cfg, store, authService, nil) // Email service is not used in gRPC
	userService := user.NewService(cfg, store)
	grpcHandler := grpc.NewHandler(
		cfg,
		authService,
		loginService,
		userService,
	)
	return grpcHandler
}
