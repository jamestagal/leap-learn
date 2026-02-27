package email

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"service-core/config"
)

type Attachment struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Content     []byte `json:"content"`
}

type Email struct {
	EmailTo          string
	EmailSubject     string
	EmailBody        string
	EmailAttachments []Attachment
}

//nolint:ireturn
func NewProvider(cfg *config.Config) provider {
	switch cfg.EmailProvider {
	case "postmark":
		return &postmarkProvider{cfg: cfg}
	case "sendgrid":
		return &sendgridProvider{cfg: cfg}
	case "resend":
		return &resendProvider{cfg: cfg}
	case "ses":
		return &sesProvider{cfg: cfg}
	case "smtp":
		return &smtpProvider{cfg: cfg}
	case "local":
		return &localProvider{cfg: cfg}
	default:
		panic("Invalid email provider")
	}
}

func sendEmail(ctx context.Context, content any, url string, headers map[string]string) error {
	var client = &http.Client{}
	var payload []byte
	var errJSON error

	if contentStr, ok := content.(string); ok {
		payload = []byte(contentStr)
	} else {
		payload, errJSON = json.Marshal(content)
		if errJSON != nil {
			return fmt.Errorf("error marshalling email body: %w", errJSON)
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("error creating email request: %w", err)
	}
	for key, value := range headers {
		req.Header.Add(key, value)
	}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error sending email request: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusAccepted {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("error sending email: %w", fmt.Errorf("status: %d, Body: %s", res.StatusCode, body))
	}
	return nil
}
