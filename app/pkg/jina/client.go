package jina

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

const readerBaseURL = "https://r.jina.ai/"

// Client communicates with the Jina Reader API.
type Client struct {
	httpClient *http.Client
	apiKey     string
}

// Option configures a Client.
type Option func(*Client)

// WithAPIKey sets the Jina API key for authenticated requests.
func WithAPIKey(key string) Option {
	return func(c *Client) {
		c.apiKey = key
	}
}

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.httpClient.Timeout = d
	}
}

// NewClient creates a new Jina Reader client.
func NewClient(opts ...Option) *Client {
	c := &Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// GetMarkdown converts a URL to clean markdown via Jina Reader.
func (c *Client) GetMarkdown(ctx context.Context, targetURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, readerBaseURL+targetURL, nil)
	if err != nil {
		return "", fmt.Errorf("jina: create request: %w", err)
	}

	req.Header.Set("Accept", "text/markdown")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("jina: execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("jina: read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("jina: unexpected status %d: %s", resp.StatusCode, string(body))
	}

	return string(body), nil
}
