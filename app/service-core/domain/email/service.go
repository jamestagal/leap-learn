package email

import (
	"app/pkg"
	"context"
	"service-core/config"
)

type provider interface {
	Send(ctx context.Context, email Email) error
	SendTemplate(ctx context.Context, templateID string, to string, data map[string]any) error
}

type Service struct {
	cfg      *config.Config
	provider provider
}

func NewService(
	cfg *config.Config,
	provider provider,
) *Service {
	return &Service{
		cfg:      cfg,
		provider: provider,
	}
}

func (s *Service) SendEmail(
	ctx context.Context,
	emailTo string,
	emailSubject string,
	emailBody string,
) error {
	ctx, cancel := context.WithTimeout(ctx, s.cfg.ContextTimeout)
	defer cancel()

	email := Email{
		EmailTo:      emailTo,
		EmailSubject: emailSubject,
		EmailBody:    emailBody,
	}

	errorChan := make(chan error, 1)
	go func() {
		errorChan <- s.provider.Send(ctx, email)
	}()

	select {
	case <-ctx.Done():
		return pkg.InternalError{Message: "Timeout sending email", Err: ctx.Err()}
	case err := <-errorChan:
		if err != nil {
			return pkg.InternalError{Message: "Error sending email", Err: err}
		}
		return nil
	}
}

func (s *Service) SendTemplateEmail(
	ctx context.Context,
	templateID string,
	to string,
	data map[string]any,
) error {
	ctx, cancel := context.WithTimeout(ctx, s.cfg.ContextTimeout)
	defer cancel()

	errorChan := make(chan error, 1)
	go func() {
		errorChan <- s.provider.SendTemplate(ctx, templateID, to, data)
	}()

	select {
	case <-ctx.Done():
		return pkg.InternalError{Message: "Timeout sending email", Err: ctx.Err()}
	case err := <-errorChan:
		if err != nil {
			return pkg.InternalError{Message: "Error sending email", Err: err}
		}
		return nil
	}
}
