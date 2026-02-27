package email

import (
	"context"
	"errors"
	"service-core/config"
)

type resendAttachment struct {
	Content  string `json:"content"`
	Filename string `json:"filename"`
}

type resendEmail struct {
	From        string             `json:"from"`
	To          []string           `json:"to"`
	Subject     string             `json:"subject"`
	HTML        string             `json:"html"`
	Attachments []resendAttachment `json:"attachments"`
}

type resendProvider struct {
	cfg *config.Config
}

func (p *resendProvider) Send(ctx context.Context, email Email) error {
	var resendURL = "https://api.resend.com/emails"

	content := resendEmail{
		From:        p.cfg.EmailFrom,
		To:          []string{email.EmailTo},
		Subject:     email.EmailSubject,
		HTML:        email.EmailBody,
		Attachments: make([]resendAttachment, 0, len(email.EmailAttachments)),
	}
	if len(email.EmailAttachments) > 0 {
		for _, attachment := range email.EmailAttachments {
			content.Attachments = append(content.Attachments, resendAttachment{
				Filename: attachment.Filename,
				Content:  string(attachment.Content),
			})
		}
	}
	headers := map[string]string{
		"Accept":        "application/json",
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + p.cfg.ResendAPIKey,
	}
	return sendEmail(ctx, content, resendURL, headers)
}

func (p *resendProvider) SendTemplate(_ context.Context, _ string, _ string, _ map[string]any) error {
	return errors.New("not implemented")
}
