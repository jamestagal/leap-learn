package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"service-core/config"
	"strconv"
	"strings"
)

type smtpProvider struct {
	cfg *config.Config
}

func (p *smtpProvider) Send(_ context.Context, email Email) error {
	to := []string{email.EmailTo}
	msg := p.buildMessage(email)

	addr := fmt.Sprintf("%s:%s", p.cfg.SMTPHost, p.cfg.SMTPPort)

	port, err := strconv.Atoi(p.cfg.SMTPPort)
	if err != nil {
		return fmt.Errorf("invalid SMTP port: %w", err)
	}

	// Only use authentication if credentials are provided and not empty
	var auth smtp.Auth
	if p.cfg.SMTPUsername != "" && p.cfg.SMTPPassword != "" {
		auth = smtp.PlainAuth("", p.cfg.SMTPUsername, p.cfg.SMTPPassword, p.cfg.SMTPHost)
	}

	if port == 465 {
		err = p.sendMailTLS(addr, auth, p.cfg.EmailFrom, to, msg)
		if err != nil {
			return fmt.Errorf("error sending email via SMTP TLS: %w", err)
		}
	} else {
		err = smtp.SendMail(addr, auth, p.cfg.EmailFrom, to, msg)
		if err != nil {
			return fmt.Errorf("error sending email via SMTP: %w", err)
		}
	}

	return nil
}

func (p *smtpProvider) SendTemplate(_ context.Context, templateID string, to string, data map[string]any) error {
	email := Email{
		EmailTo:      to,
		EmailSubject: fmt.Sprintf("Template: %s", templateID),
		EmailBody:    fmt.Sprintf("Template ID: %s\nData: %+v", templateID, data),
	}
	return p.Send(context.Background(), email)
}

func (p *smtpProvider) buildMessage(email Email) []byte {
	var msg strings.Builder

	msg.WriteString(fmt.Sprintf("From: %s\r\n", p.cfg.EmailFrom))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", email.EmailTo))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", email.EmailSubject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(email.EmailBody)

	return []byte(msg.String())
}

func (p *smtpProvider) sendMailTLS(addr string, auth smtp.Auth, from string, to []string, msg []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: p.cfg.SMTPHost})
	if err != nil {
		return fmt.Errorf("error creating TLS connection: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, p.cfg.SMTPHost)
	if err != nil {
		return fmt.Errorf("error creating SMTP client: %w", err)
	}
	defer client.Quit()

	// Only authenticate if auth is provided
	if auth != nil {
		err = client.Auth(auth)
		if err != nil {
			return fmt.Errorf("error authenticating SMTP client: %w", err)
		}
	}

	err = client.Mail(from)
	if err != nil {
		return fmt.Errorf("error setting sender: %w", err)
	}

	for _, addr := range to {
		err = client.Rcpt(addr)
		if err != nil {
			return fmt.Errorf("error setting recipient %s: %w", addr, err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("error getting data writer: %w", err)
	}

	_, err = w.Write(msg)
	if err != nil {
		return fmt.Errorf("error writing message: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("error closing message: %w", err)
	}

	return nil
}