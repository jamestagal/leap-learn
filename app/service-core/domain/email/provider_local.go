package email

import (
	"context"
	"log/slog"
	"service-core/config"
)

type localProvider struct {
	cfg *config.Config
}

func (p *localProvider) Send(_ context.Context, email Email) error {
	slog.Info("Email Send", "From", p.cfg.EmailFrom, "EmailTo", email.EmailTo, "EmailSubject", email.EmailSubject, "EmailBody", email.EmailBody)
	return nil
}

func (p *localProvider) SendTemplate(_ context.Context, templateID string, to string, _ map[string]any) error {
	slog.Info("Email Send", "From", p.cfg.EmailFrom, "TemplateID", templateID, "EmailTo", to)
	return nil
}
