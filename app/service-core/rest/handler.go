package rest

import (
	"app/pkg/auth"
	"service-core/config"
	"service-core/domain/billing"
	"service-core/domain/email"
	"service-core/domain/file"
	"service-core/domain/login"
	"service-core/domain/note"
	"service-core/storage"
)

type Handler struct {
	cfg            *config.Config
	storage        *storage.Storage
	authService    auth.AuthService
	loginService   *login.Service
	billingService *billing.Service
	emailService   *email.Service
	fileService    *file.Service
	noteService    *note.Service
}

func NewHandler(
	config *config.Config,
	storage *storage.Storage,
	authService auth.AuthService,
	loginService *login.Service,
	billingService *billing.Service,
	emailService *email.Service,
	fileService *file.Service,
	noteService *note.Service,
) *Handler {
	return &Handler{
		cfg:            config,
		storage:        storage,
		authService:    authService,
		loginService:   loginService,
		billingService: billingService,
		emailService:   emailService,
		fileService:    fileService,
		noteService:    noteService,
	}
}
