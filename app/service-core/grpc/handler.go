package grpc

import (
	"app/pkg/auth"
	"service-core/config"
	"service-core/domain/login"
	"service-core/domain/user"
)

type Handler struct {
	cfg          *config.Config
	authService  *auth.Service
	loginService *login.Service
	userService  *user.Service
}

func NewHandler(
	cfg *config.Config,
	authService *auth.Service,
	loginService *login.Service,
	userService *user.Service,
) *Handler {
	return &Handler{
		cfg:          cfg,
		authService:  authService,
		loginService: loginService,
		userService:  userService,
	}
}
