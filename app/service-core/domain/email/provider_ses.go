package email

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"mime/multipart"
	"net/textproto"
	"net/url"
	"service-core/config"
	"time"
)

type sesProvider struct {
	cfg *config.Config
}

func (p *sesProvider) Send(ctx context.Context, email Email) error {
	var sesURL = "https://email.%s.amazonaws.com"

	region := p.cfg.SesRegion
	accessKey := p.cfg.SesAccessKey
	secretKey := p.cfg.SesSecretKey

	endpoint := fmt.Sprintf(sesURL, region)

	// Parse endpoint to get the hostname
	parsedURL, err := url.Parse(endpoint)
	if err != nil {
		return fmt.Errorf("error parsing endpoint: %w", err)
	}
	hostname := parsedURL.Hostname()

	// Get current date and time
	now := time.Now().UTC()
	dateTime := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	// Prepare the request payload
	content := createPayload(p.cfg.EmailFrom, email.EmailTo, email.EmailSubject, email.EmailBody)
	if len(email.EmailAttachments) > 0 {
		mimeMessage, err := createMIMEMessage(email, p.cfg.EmailFrom)
		if err != nil {
			return fmt.Errorf("error creating MIME message: %w", err)
		}
		content = createRawPayload(mimeMessage)
	}

	// Prepare the canonical request and string to sign
	canonicalRequest := "POST\n/\n\ncontent-type:application/x-www-form-urlencoded\nhost:" + hostname +
		"\nx-amz-date:" + dateTime + "\n\ncontent-type;host;x-amz-date\n" + hashSHA256(content)
	credentialScope := dateStamp + "/" + region + "/ses/aws4_request"
	stringToSign := fmt.Sprintf("AWS4-HMAC-SHA256\n%s\n%s\n%s", dateTime, credentialScope,
		hashSHA256(canonicalRequest))

	// Create the signing key and compute the signature
	signingKey := getSignatureKey(secretKey, dateStamp, region, "ses")
	signature := hex.EncodeToString(sign(signingKey, stringToSign))

	// Create authorization headers
	authorization := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=content-type;host;x-amz-date, Signature=%s", accessKey, credentialScope, signature)
	headers := map[string]string{
		"Content-Type":  "application/x-www-form-urlencoded",
		"X-Amz-Date":    dateTime,
		"Authorization": authorization,
	}

	return sendEmail(ctx, content, endpoint, headers)
}

func (p *sesProvider) SendTemplate(_ context.Context, _ string, _ string, _ map[string]any) error {
	return errors.New("not implemented")
}

func createMIMEMessage(email Email, emailFrom string) (string, error) {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	boundary := writer.Boundary()

	headers := map[string]string{
		"Content-Type": fmt.Sprintf("multipart/mixed; boundary=\"%s\"", boundary),
		"From":         emailFrom,
		"To":           email.EmailTo,
		"Subject":      email.EmailSubject,
		"MIME-Version": "1.0",
	}

	for key, value := range headers {
		buf.WriteString(fmt.Sprintf("%s: %s\r\n", key, value))
	}

	buf.WriteString("\r\n")

	// Write body part
	bodyWriter, _ := writer.CreatePart(textproto.MIMEHeader{
		"Content-Type": {"text/plain; charset=UTF-8"},
	})

	_, err := bodyWriter.Write([]byte(email.EmailBody))
	if err != nil {
		return "", fmt.Errorf("error writing body: %w", err)
	}

	// Write attachment part
	for _, attachment := range email.EmailAttachments {
		// Write attachment part
		fileWriter, _ := writer.CreatePart(textproto.MIMEHeader{
			"Content-Type":              {"application/octet-stream"},
			"Content-Disposition":       {fmt.Sprintf("attachment; filename=\"%s\"", attachment.Filename)},
			"Content-Transfer-Encoding": {"base64"},
		})
		fileData := base64.StdEncoding.EncodeToString(attachment.Content)
		_, err = fileWriter.Write([]byte(fileData))
		if err != nil {
			return "", fmt.Errorf("error writing attachment: %w", err)
		}
	}

	return buf.String(), nil
}

// Helper function to sign a message using HMAC SHA256
func sign(key []byte, message string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(message))
	return h.Sum(nil)
}

// Create AWS Signature Key
func getSignatureKey(secretKey, dateStamp, region, service string) []byte {
	kDate := sign([]byte("AWS4"+secretKey), dateStamp)
	kRegion := sign(kDate, region)
	kService := sign(kRegion, service)
	kSigning := sign(kService, "aws4_request")
	return kSigning
}

// Create the canonical request payload for Ses SendEmail
func createPayload(from, to, subject, body string) string {
	form := url.Values{}
	form.Set("Action", "SendEmail")
	form.Set("Source", from)
	form.Set("Destination.ToAddresses.member.1", to)
	form.Set("Message.Subject.Data", subject)
	form.Set("Message.Body.Text.Data", body)

	return form.Encode()
}

// Create the canonical request payload for Ses SendRawEmail
func createRawPayload(body string) string {
	form := url.Values{}
	form.Set("Action", "SendRawEmail")
	form.Set("RawMessage.Data", base64.StdEncoding.EncodeToString([]byte(body)))

	return form.Encode()
}

// Hash the payload using SHA-256
func hashSHA256(payload string) string {
	hash := sha256.New()
	hash.Write([]byte(payload))
	return hex.EncodeToString(hash.Sum(nil))
}
