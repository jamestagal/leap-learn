package cfbrowser

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

// Client communicates with a Cloudflare Browser Rendering Worker.
type Client struct {
	baseURL    string
	httpClient *http.Client
	sem        chan struct{}
}

// Option configures a Client.
type Option func(*Client)

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.httpClient.Timeout = d
	}
}

// WithMaxConcurrent sets the maximum number of concurrent requests. Default: 10.
func WithMaxConcurrent(n int) Option {
	return func(c *Client) {
		c.sem = make(chan struct{}, n)
	}
}

// NewClient creates a new CF Browser Rendering client.
func NewClient(workerURL string, opts ...Option) *Client {
	c := &Client{
		baseURL:    workerURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		sem:        make(chan struct{}, 10),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

const maxRetries = 3

// doRequest performs a rate-limited HTTP POST with retry on 429 and 5xx.
func (c *Client) doRequest(ctx context.Context, path string, body any) ([]byte, error) {
	// Acquire semaphore slot.
	select {
	case c.sem <- struct{}{}:
	case <-ctx.Done():
		return nil, fmt.Errorf("cfbrowser: %w", ctx.Err())
	}
	defer func() { <-c.sem }()

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("cfbrowser: marshal request: %w", err)
	}

	var lastErr error
	backoff := 1 * time.Second

	for attempt := 0; attempt < maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(payload))
		if err != nil {
			return nil, fmt.Errorf("cfbrowser: create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("cfbrowser: execute request: %w", err)
		}

		respBody, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("cfbrowser: read response: %w", readErr)
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return respBody, nil
		}

		lastErr = fmt.Errorf("cfbrowser: unexpected status %d: %s", resp.StatusCode, string(respBody))

		// Rate limited — use Retry-After if present.
		if resp.StatusCode == http.StatusTooManyRequests {
			wait := backoff
			if ra := resp.Header.Get("Retry-After"); ra != "" {
				if seconds, parseErr := strconv.Atoi(ra); parseErr == nil {
					wait = time.Duration(seconds) * time.Second
				}
			}
			if err := sleep(ctx, wait); err != nil {
				return nil, fmt.Errorf("cfbrowser: %w", err)
			}
			backoff *= 2
			continue
		}

		// Server error — exponential backoff.
		if resp.StatusCode >= 500 {
			if err := sleep(ctx, backoff); err != nil {
				return nil, fmt.Errorf("cfbrowser: %w", err)
			}
			backoff *= 2
			continue
		}

		// Client error (4xx except 429) — don't retry.
		return nil, lastErr
	}

	return nil, fmt.Errorf("cfbrowser: max retries exceeded: %w", lastErr)
}

// sleep waits for the given duration or until the context is cancelled.
func sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
