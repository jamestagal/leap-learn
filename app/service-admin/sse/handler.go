package sse

import (
	"service-admin/auth"
	"service-admin/pubsub"
	"service-admin/config"
)

type Handler struct {
	cfg         *config.Config
	broker      *pubsub.EventBroker
	authService *auth.Service
}

func NewHandler(
	config *config.Config,
	broker *pubsub.EventBroker,
	authService *auth.Service,
) *Handler {
	return &Handler{
		cfg:         config,
		broker:      broker,
		authService: authService,
	}
}
