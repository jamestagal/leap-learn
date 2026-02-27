package email

import (
	"context"
	"encoding/base64"
	"service-core/config"
)

type postmarkAttachment struct {
	Name        string `json:"Name"`
	Content     string `json:"Content"`
	ContentType string `json:"ContentType"`
}

type postmarkEmail struct {
	From          string               `json:"From"`
	To            string               `json:"To"`
	Subject       string               `json:"Subject"`
	HTMLBody      string               `json:"HtmlBody"`
	MessageStream string               `json:"MessageStream"`
	Attachments   []postmarkAttachment `json:"Attachments"`
}

type postmarkTemplate struct {
	From          string `json:"From"`
	To            string `json:"To"`
	TemplateID    string `json:"TemplateId"`
	TemplateModel any    `json:"TemplateModel"`
}

type postmarkProvider struct {
	cfg *config.Config
}

func (p *postmarkProvider) Send(ctx context.Context, email Email) error {
	var postmarkURL = "https://api.postmarkapp.com/email"

	content := postmarkEmail{
		From:          p.cfg.EmailFrom,
		To:            email.EmailTo,
		Subject:       email.EmailSubject,
		HTMLBody:      email.EmailBody,
		MessageStream: "outbound",
		Attachments:   make([]postmarkAttachment, 0, len(email.EmailAttachments)),
	}

	for _, attachment := range email.EmailAttachments {
		content.Attachments = append(content.Attachments, postmarkAttachment{
			Name:        attachment.Filename,
			Content:     base64.StdEncoding.EncodeToString(attachment.Content),
			ContentType: attachment.ContentType,
		})
	}

	headers := map[string]string{
		"Accept":                  "application/json",
		"Content-Type":            "application/json",
		"X-Postmark-Server-Token": p.cfg.PostmarkAPIKey,
	}
	return sendEmail(ctx, content, postmarkURL, headers)
}

func (p *postmarkProvider) SendTemplate(ctx context.Context, templateID string, to string, data map[string]any) error {
	var postmarkURL = "https://api.postmarkapp.com/email/withTemplate"

	content := postmarkTemplate{
		From:          p.cfg.EmailFrom,
		To:            to,
		TemplateID:    templateID,
		TemplateModel: data,
	}

	headers := map[string]string{
		"Accept":                  "application/json",
		"Content-Type":            "application/json",
		"X-Postmark-Server-Token": p.cfg.PostmarkAPIKey,
	}
	return sendEmail(ctx, content, postmarkURL, headers)
}
