package rest

import (
	"app/pkg/auth"
	"service-core/config"
	"service-core/domain/billing"
	"service-core/domain/login"
	"service-core/storage"
)

type Handler struct {
	cfg            *config.Config
	storage        *storage.Storage
	authService    auth.AuthService
	loginService   *login.Service
	billingService *billing.Service
}

func NewHandler(
	config *config.Config,
	storage *storage.Storage,
	authService auth.AuthService,
	loginService *login.Service,
	billingService *billing.Service,
) *Handler {
	return &Handler{
		cfg:            config,
		storage:        storage,
		authService:    authService,
		loginService:   loginService,
		billingService: billingService,
	}
}
