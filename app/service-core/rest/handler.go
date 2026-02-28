package rest

import (
	"app/pkg/auth"
	"service-core/config"
	"service-core/domain/billing"
	"service-core/domain/h5p"
	"service-core/domain/login"
	"service-core/storage"
)

type Handler struct {
	cfg            *config.Config
	storage        *storage.Storage
	authService    auth.AuthService
	loginService   *login.Service
	billingService *billing.Service
	h5pService     *h5p.Service
}

func NewHandler(
	config *config.Config,
	storage *storage.Storage,
	authService auth.AuthService,
	loginService *login.Service,
	billingService *billing.Service,
	h5pService *h5p.Service,
) *Handler {
	return &Handler{
		cfg:            config,
		storage:        storage,
		authService:    authService,
		loginService:   loginService,
		billingService: billingService,
		h5pService:     h5pService,
	}
}
