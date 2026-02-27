package dataforseo

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"time"
)

const defaultBaseURL = "https://api.dataforseo.com/v3"

// ErrTaskNotReady indicates an async task hasn't been processed yet (40400 Not Found).
// Callers should retry after a delay.
var ErrTaskNotReady = fmt.Errorf("dataforseo: task not ready")

// Client is a thread-safe DataForSEO API client.
type Client struct {
	baseURL    string
	authHeader string
	httpClient *http.Client
	sem        chan struct{}
}

// Option configures the Client.
type Option func(*Client)

// WithBaseURL overrides the default API base URL.
func WithBaseURL(url string) Option {
	return func(c *Client) {
		c.baseURL = url
	}
}

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.httpClient.Timeout = d
	}
}

// WithMaxConcurrent sets the maximum number of concurrent requests.
func WithMaxConcurrent(n int) Option {
	return func(c *Client) {
		c.sem = make(chan struct{}, n)
	}
}

// NewClient creates a new DataForSEO API client.
func NewClient(login, password string, opts ...Option) *Client {
	c := &Client{
		baseURL:    defaultBaseURL,
		authHeader: "Basic " + base64.StdEncoding.EncodeToString([]byte(login+":"+password)),
		httpClient: &http.Client{Timeout: 30 * time.Second},
		sem:        make(chan struct{}, 5),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Response is the top-level envelope returned by all DataForSEO endpoints.
type Response struct {
	Version       string  `json:"version"`
	StatusCode    int     `json:"status_code"`
	StatusMessage string  `json:"status_message"`
	Time          string  `json:"time"`
	Cost          float64 `json:"cost"`
	TasksCount    int     `json:"tasks_count"`
	TasksError    int     `json:"tasks_error"`
	Tasks         []Task  `json:"tasks"`
}

// Task represents a single task within a DataForSEO response.
type Task struct {
	ID            string          `json:"id"`
	StatusCode    int             `json:"status_code"`
	StatusMessage string          `json:"status_message"`
	Time          string          `json:"time"`
	Cost          float64         `json:"cost"`
	ResultCount   int             `json:"result_count"`
	Path          []string        `json:"path"`
	Data          json.RawMessage `json:"data"`
	Result        json.RawMessage `json:"result"`
}

// post sends a POST request with rate limiting, retry on 5xx/429, and response
// envelope validation. The payload is wrapped in an array as required by the API.
func (c *Client) post(ctx context.Context, path string, payload any) (*Response, error) {
	// Acquire semaphore.
	select {
	case c.sem <- struct{}{}:
		defer func() { <-c.sem }()
	case <-ctx.Done():
		return nil, fmt.Errorf("dataforseo: %w", ctx.Err())
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("dataforseo: marshal payload: %w", err)
	}

	var resp *Response
	maxRetries := 3
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, fmt.Errorf("dataforseo: %w", ctx.Err())
			}
		}

		req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
		if reqErr != nil {
			return nil, fmt.Errorf("dataforseo: create request: %w", reqErr)
		}
		req.Header.Set("Authorization", c.authHeader)
		req.Header.Set("Content-Type", "application/json")

		httpResp, doErr := c.httpClient.Do(req)
		if doErr != nil {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: request failed: %w", doErr)
			}
			continue
		}

		respBody, readErr := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		if readErr != nil {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: read response: %w", readErr)
			}
			continue
		}

		if httpResp.StatusCode == 429 || httpResp.StatusCode >= 500 {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: HTTP %d: %s", httpResp.StatusCode, string(respBody))
			}
			continue
		}

		if httpResp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("dataforseo: HTTP %d: %s", httpResp.StatusCode, string(respBody))
		}

		resp = &Response{}
		if jsonErr := json.Unmarshal(respBody, resp); jsonErr != nil {
			return nil, fmt.Errorf("dataforseo: unmarshal response: %w", jsonErr)
		}
		break
	}

	if resp == nil {
		return nil, fmt.Errorf("dataforseo: no response after %d retries", maxRetries)
	}

	if resp.StatusCode != 20000 {
		return nil, fmt.Errorf("dataforseo: API error %d: %s", resp.StatusCode, resp.StatusMessage)
	}

	return resp, nil
}

// postRaw is like post but does NOT check the envelope status code.
// Use this for endpoints where non-20000 status codes have specific meaning
// (e.g. 40400 = task not ready on on_page/summary).
func (c *Client) postRaw(ctx context.Context, path string, payload any) (*Response, error) {
	select {
	case c.sem <- struct{}{}:
		defer func() { <-c.sem }()
	case <-ctx.Done():
		return nil, fmt.Errorf("dataforseo: %w", ctx.Err())
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("dataforseo: marshal payload: %w", err)
	}

	var resp *Response
	maxRetries := 3
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, fmt.Errorf("dataforseo: %w", ctx.Err())
			}
		}

		req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
		if reqErr != nil {
			return nil, fmt.Errorf("dataforseo: create request: %w", reqErr)
		}
		req.Header.Set("Authorization", c.authHeader)
		req.Header.Set("Content-Type", "application/json")

		httpResp, doErr := c.httpClient.Do(req)
		if doErr != nil {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: request failed: %w", doErr)
			}
			continue
		}

		respBody, readErr := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		if readErr != nil {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: read response: %w", readErr)
			}
			continue
		}

		if httpResp.StatusCode == 429 || httpResp.StatusCode >= 500 {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: HTTP %d: %s", httpResp.StatusCode, string(respBody))
			}
			continue
		}

		if httpResp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("dataforseo: HTTP %d: %s", httpResp.StatusCode, string(respBody))
		}

		resp = &Response{}
		if jsonErr := json.Unmarshal(respBody, resp); jsonErr != nil {
			return nil, fmt.Errorf("dataforseo: unmarshal response: %w", jsonErr)
		}
		break
	}

	if resp == nil {
		return nil, fmt.Errorf("dataforseo: no response after %d retries", maxRetries)
	}

	// NOTE: intentionally not checking resp.StatusCode — caller handles it
	return resp, nil
}

// getRaw sends a GET request with rate limiting and retry. Does NOT check
// the envelope status code — caller handles it (like postRaw).
func (c *Client) getRaw(ctx context.Context, path string) (*Response, error) {
	select {
	case c.sem <- struct{}{}:
		defer func() { <-c.sem }()
	case <-ctx.Done():
		return nil, fmt.Errorf("dataforseo: %w", ctx.Err())
	}

	var resp *Response
	maxRetries := 3
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, fmt.Errorf("dataforseo: %w", ctx.Err())
			}
		}

		req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
		if reqErr != nil {
			return nil, fmt.Errorf("dataforseo: create request: %w", reqErr)
		}
		req.Header.Set("Authorization", c.authHeader)

		httpResp, doErr := c.httpClient.Do(req)
		if doErr != nil {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: request failed: %w", doErr)
			}
			continue
		}

		respBody, readErr := io.ReadAll(httpResp.Body)
		httpResp.Body.Close()
		if readErr != nil {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: read response: %w", readErr)
			}
			continue
		}

		if httpResp.StatusCode == 429 || httpResp.StatusCode >= 500 {
			if attempt == maxRetries-1 {
				return nil, fmt.Errorf("dataforseo: HTTP %d: %s", httpResp.StatusCode, string(respBody))
			}
			continue
		}

		if httpResp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("dataforseo: HTTP %d: %s", httpResp.StatusCode, string(respBody))
		}

		resp = &Response{}
		if jsonErr := json.Unmarshal(respBody, resp); jsonErr != nil {
			return nil, fmt.Errorf("dataforseo: unmarshal response: %w", jsonErr)
		}
		break
	}

	if resp == nil {
		return nil, fmt.Errorf("dataforseo: no response after %d retries", maxRetries)
	}

	return resp, nil
}

// firstResult extracts the result from the first task and unmarshals it into dst.
// It returns an error if there are no tasks or the first task has an error status.
func (c *Client) firstResult(resp *Response, dst any) error {
	if len(resp.Tasks) == 0 {
		return fmt.Errorf("dataforseo: no tasks in response")
	}
	task := resp.Tasks[0]
	if task.StatusCode != 20000 {
		return fmt.Errorf("dataforseo: task error %d: %s", task.StatusCode, task.StatusMessage)
	}
	if task.Result == nil {
		return fmt.Errorf("dataforseo: empty result")
	}
	if err := json.Unmarshal(task.Result, dst); err != nil {
		return fmt.Errorf("dataforseo: unmarshal result: %w", err)
	}
	return nil
}
