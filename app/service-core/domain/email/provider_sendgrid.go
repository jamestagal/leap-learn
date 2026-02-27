package email

import (
	"context"
	"encoding/base64"
	"errors"
	"service-core/config"
)

type sendgridAttachments struct {
	Content  string `json:"content"`
	Type     string `json:"type"`
	Filename string `json:"filename"`
}

type sendgridEmail struct {
	Personalizations []struct {
		To []struct {
			Email string `json:"email"`
		} `json:"to"`
	} `json:"personalizations"`
	From struct {
		Email string `json:"email"`
	} `json:"from"`
	Subject string `json:"subject"`
	Content []struct {
		Type  string `json:"type"`
		Value string `json:"value"`
	} `json:"content"`
	Attachments []sendgridAttachments `json:"attachments"`
}

type sendgridProvider struct {
	cfg *config.Config
}

func (p *sendgridProvider) Send(ctx context.Context, email Email) error {
	var sendgridURL = "https://api.sendgrid.com/v3/mail/send"

	content := sendgridEmail{
		Personalizations: []struct {
			To []struct {
				Email string `json:"email"`
			} `json:"to"`
		}{
			{
				To: []struct {
					Email string `json:"email"`
				}{
					{
						Email: email.EmailTo,
					},
				},
			},
		},
		From: struct {
			Email string `json:"email"`
		}{
			Email: p.cfg.EmailFrom,
		},
		Subject: email.EmailSubject,
		Content: []struct {
			Type  string `json:"type"`
			Value string `json:"value"`
		}{
			{
				Type:  "text/html",
				Value: email.EmailBody,
			},
		},
		Attachments: make([]sendgridAttachments, 0, len(email.EmailAttachments)),
	}

	if len(email.EmailAttachments) > 0 {
		for _, attachment := range email.EmailAttachments {
			content.Attachments = append(content.Attachments, sendgridAttachments{
				Filename: attachment.Filename,
				Type:     attachment.ContentType,
				Content:  base64.StdEncoding.EncodeToString(attachment.Content),
			})
		}
	}

	headers := map[string]string{
		"Accept":        "application/json",
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + p.cfg.SendgridAPIKey,
	}
	return sendEmail(ctx, content, sendgridURL, headers)
}

func (p *sendgridProvider) SendTemplate(_ context.Context, _ string, _ string, _ map[string]any) error {
	return errors.New("not implemented")
}
