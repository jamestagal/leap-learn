package cfbrowser

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// NewClient
// ---------------------------------------------------------------------------

func TestNewClient_Defaults(t *testing.T) {
	c := NewClient("http://localhost:8787")

	assert.Equal(t, "http://localhost:8787", c.baseURL)
	assert.Equal(t, 30*time.Second, c.httpClient.Timeout)
	assert.Equal(t, 10, cap(c.sem))
}

func TestNewClient_WithOptions(t *testing.T) {
	c := NewClient("http://localhost:8787",
		WithTimeout(60*time.Second),
		WithMaxConcurrent(5),
	)

	assert.Equal(t, 60*time.Second, c.httpClient.Timeout)
	assert.Equal(t, 5, cap(c.sem))
}

// ---------------------------------------------------------------------------
// GetMarkdown
// ---------------------------------------------------------------------------

func TestGetMarkdown_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/markdown", r.URL.Path)
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		var req MarkdownRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, "http://example.com", req.URL)

		json.NewEncoder(w).Encode(MarkdownResponse{
			Content: "# Hello World",
			Title:   "Hello World",
			URL:     "http://example.com",
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	resp, err := client.GetMarkdown(context.Background(), "http://example.com")

	require.NoError(t, err)
	assert.Equal(t, "# Hello World", resp.Content)
	assert.Equal(t, "Hello World", resp.Title)
	assert.Equal(t, "http://example.com", resp.URL)
}

func TestGetMarkdown_ServerError(t *testing.T) {
	var attempts int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer srv.Close()

	client := NewClient(srv.URL, WithTimeout(5*time.Second))

	// Use a context with timeout so the retries with backoff don't hang forever.
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	_, err := client.GetMarkdown(ctx, "http://example.com")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "max retries exceeded")
	assert.Contains(t, err.Error(), "unexpected status 500")
	assert.Equal(t, int32(maxRetries), atomic.LoadInt32(&attempts))
}

func TestGetMarkdown_InvalidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("not json at all{{{"))
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	_, err := client.GetMarkdown(context.Background(), "http://example.com")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "decode markdown response")
}

// ---------------------------------------------------------------------------
// GetLinks
// ---------------------------------------------------------------------------

func TestGetLinks_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/links", r.URL.Path)

		var req LinksRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, "http://example.com", req.URL)

		json.NewEncoder(w).Encode(LinksResponse{
			Links: []Link{
				{URL: "http://example.com/about", Text: "About"},
				{URL: "http://example.com/contact", Text: "Contact"},
			},
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	resp, err := client.GetLinks(context.Background(), "http://example.com")

	require.NoError(t, err)
	require.Len(t, resp.Links, 2)
	assert.Equal(t, "http://example.com/about", resp.Links[0].URL)
	assert.Equal(t, "About", resp.Links[0].Text)
	assert.Equal(t, "http://example.com/contact", resp.Links[1].URL)
	assert.Equal(t, "Contact", resp.Links[1].Text)
}

func TestGetLinks_EmptyResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(LinksResponse{Links: []Link{}})
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	resp, err := client.GetLinks(context.Background(), "http://example.com")

	require.NoError(t, err)
	assert.Empty(t, resp.Links)
}

// ---------------------------------------------------------------------------
// Scrape
// ---------------------------------------------------------------------------

func TestScrape_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "/scrape", r.URL.Path)

		var req ScrapeRequest
		require.NoError(t, json.NewDecoder(r.Body).Decode(&req))
		assert.Equal(t, "http://example.com", req.URL)
		assert.Equal(t, "h1", req.Selectors["title"])
		assert.Equal(t, "meta[name=description]", req.Selectors["description"])

		json.NewEncoder(w).Encode(ScrapeResponse{
			Data: map[string]string{
				"title":       "Example Domain",
				"description": "This domain is for examples.",
			},
			URL: "http://example.com",
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	selectors := map[string]string{
		"title":       "h1",
		"description": "meta[name=description]",
	}
	resp, err := client.Scrape(context.Background(), "http://example.com", selectors)

	require.NoError(t, err)
	assert.Equal(t, "Example Domain", resp.Data["title"])
	assert.Equal(t, "This domain is for examples.", resp.Data["description"])
	assert.Equal(t, "http://example.com", resp.URL)
}

// ---------------------------------------------------------------------------
// doRequest — retry behaviour
// ---------------------------------------------------------------------------

func TestDoRequest_Retry429(t *testing.T) {
	var attempts int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&attempts, 1)
		if n <= 2 {
			w.Header().Set("Retry-After", "0") // 0 seconds so the test is fast
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte("rate limited"))
			return
		}
		json.NewEncoder(w).Encode(MarkdownResponse{
			Content: "# Success after retries",
			Title:   "Retry Test",
			URL:     "http://example.com",
		})
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	resp, err := client.GetMarkdown(context.Background(), "http://example.com")

	require.NoError(t, err)
	assert.Equal(t, "# Success after retries", resp.Content)
	assert.Equal(t, int32(3), atomic.LoadInt32(&attempts))
}

func TestDoRequest_ClientError4xx(t *testing.T) {
	var attempts int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("bad request"))
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	_, err := client.GetMarkdown(context.Background(), "http://example.com")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unexpected status 400")
	// 4xx (non-429) should NOT be retried.
	assert.Equal(t, int32(1), atomic.LoadInt32(&attempts))
}

func TestDoRequest_ContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Delay long enough that the context will be cancelled first.
		time.Sleep(5 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := NewClient(srv.URL)
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately.

	_, err := client.GetMarkdown(ctx, "http://example.com")

	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)
}

func TestDoRequest_ConcurrencyLimit(t *testing.T) {
	// Track how many requests are being handled concurrently.
	var inflight int32
	var maxInflight int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cur := atomic.AddInt32(&inflight, 1)
		// Update peak concurrency.
		for {
			old := atomic.LoadInt32(&maxInflight)
			if cur <= old || atomic.CompareAndSwapInt32(&maxInflight, old, cur) {
				break
			}
		}

		time.Sleep(100 * time.Millisecond) // Hold the slot briefly.
		atomic.AddInt32(&inflight, -1)

		json.NewEncoder(w).Encode(MarkdownResponse{Content: "ok"})
	}))
	defer srv.Close()

	client := NewClient(srv.URL, WithMaxConcurrent(1))

	// Fire 3 concurrent requests.
	done := make(chan struct{}, 3)
	for i := 0; i < 3; i++ {
		go func() {
			defer func() { done <- struct{}{} }()
			_, _ = client.GetMarkdown(context.Background(), "http://example.com")
		}()
	}

	for i := 0; i < 3; i++ {
		<-done
	}

	// With MaxConcurrent(1), at most 1 request should be in-flight at a time.
	assert.Equal(t, int32(1), atomic.LoadInt32(&maxInflight))
}
