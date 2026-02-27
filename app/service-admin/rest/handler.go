package rest

import (
	"service-admin/auth"
	"service-admin/grpc"
	"service-admin/pubsub"
	"service-admin/config"
)

type Handler struct {
	cfg         *config.Config
	conn        *grpc.Conn
	broker      *pubsub.EventBroker
	authService *auth.Service
}

func NewHandler(
	config *config.Config,
	conn *grpc.Conn,
	broker *pubsub.EventBroker,
	authService *auth.Service,
) *Handler {
	return &Handler{
		cfg:         config,
		conn:        conn,
		broker:      broker,
		authService: authService,
	}
}
