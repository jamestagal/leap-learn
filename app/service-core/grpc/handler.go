package grpc

import (
	"app/pkg/auth"
	"service-core/domain/login"
	"service-core/domain/note"
	"service-core/domain/user"
	"service-core/config"
)

type Handler struct {
	cfg          *config.Config
	authService  *auth.Service
	loginService *login.Service
	userService  *user.Service
	noteService  *note.Service
}

func NewHandler(
	cfg *config.Config,
	authService *auth.Service,
	loginService *login.Service,
	userService *user.Service,
	noteService *note.Service,
) *Handler {
	return &Handler{
		cfg:          cfg,
		authService:  authService,
		loginService: loginService,
		userService:  userService,
		noteService:  noteService,
	}
}
