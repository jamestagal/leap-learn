package jina

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// NewClient
// ---------------------------------------------------------------------------

func TestNewClient_Defaults(t *testing.T) {
	c := NewClient()

	assert.Equal(t, 30*time.Second, c.httpClient.Timeout)
	assert.Empty(t, c.apiKey)
}

func TestNewClient_WithAPIKey(t *testing.T) {
	c := NewClient(WithAPIKey("test-key-123"))

	assert.Equal(t, "test-key-123", c.apiKey)
}

func TestNewClient_WithTimeout(t *testing.T) {
	c := NewClient(WithTimeout(60 * time.Second))

	assert.Equal(t, 60*time.Second, c.httpClient.Timeout)
}

// ---------------------------------------------------------------------------
// GetMarkdown
// ---------------------------------------------------------------------------

func TestGetMarkdown_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		assert.Equal(t, "text/markdown", r.Header.Get("Accept"))
		// No Authorization header when no API key is set.
		assert.Empty(t, r.Header.Get("Authorization"))

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("# Hello World\n\nThis is markdown content."))
	}))
	defer srv.Close()

	// Override the base URL by creating a client that talks to our test server.
	// Since the jina client hardcodes readerBaseURL, we need to use a workaround:
	// we create a client and replace its httpClient with one that redirects to our server.
	client := &Client{
		httpClient: srv.Client(),
	}

	// The Jina client constructs URL as readerBaseURL + targetURL.
	// With httptest, we need to point requests to srv.URL instead.
	// Simplest approach: replace the httpClient transport to rewrite the host.
	client.httpClient.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		req.URL.Scheme = "http"
		req.URL.Host = srv.Listener.Addr().String()
		return http.DefaultTransport.RoundTrip(req)
	})

	result, err := client.GetMarkdown(context.Background(), "http://example.com")

	require.NoError(t, err)
	assert.Equal(t, "# Hello World\n\nThis is markdown content.", result)
}

func TestGetMarkdown_WithAPIKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify the Authorization header is set correctly.
		authHeader := r.Header.Get("Authorization")
		assert.Equal(t, "Bearer my-secret-key", authHeader)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("# Authenticated Content"))
	}))
	defer srv.Close()

	client := &Client{
		httpClient: srv.Client(),
		apiKey:     "my-secret-key",
	}
	client.httpClient.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		req.URL.Scheme = "http"
		req.URL.Host = srv.Listener.Addr().String()
		return http.DefaultTransport.RoundTrip(req)
	})

	result, err := client.GetMarkdown(context.Background(), "http://example.com")

	require.NoError(t, err)
	assert.Equal(t, "# Authenticated Content", result)
}

func TestGetMarkdown_ServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal server error"))
	}))
	defer srv.Close()

	client := &Client{httpClient: srv.Client()}
	client.httpClient.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		req.URL.Scheme = "http"
		req.URL.Host = srv.Listener.Addr().String()
		return http.DefaultTransport.RoundTrip(req)
	})

	_, err := client.GetMarkdown(context.Background(), "http://example.com")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unexpected status 500")
	assert.Contains(t, err.Error(), "internal server error")
}

func TestGetMarkdown_NotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("page not found"))
	}))
	defer srv.Close()

	client := &Client{httpClient: srv.Client()}
	client.httpClient.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		req.URL.Scheme = "http"
		req.URL.Host = srv.Listener.Addr().String()
		return http.DefaultTransport.RoundTrip(req)
	})

	_, err := client.GetMarkdown(context.Background(), "http://example.com/missing")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unexpected status 404")
	assert.Contains(t, err.Error(), "page not found")
}

func TestGetMarkdown_ContextCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Second) // Long delay.
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := &Client{httpClient: srv.Client()}
	client.httpClient.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		req.URL.Scheme = "http"
		req.URL.Host = srv.Listener.Addr().String()
		return http.DefaultTransport.RoundTrip(req)
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately.

	_, err := client.GetMarkdown(ctx, "http://example.com")

	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)
}

func TestGetMarkdown_EmptyResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		// Write nothing — empty body.
	}))
	defer srv.Close()

	client := &Client{httpClient: srv.Client()}
	client.httpClient.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		req.URL.Scheme = "http"
		req.URL.Host = srv.Listener.Addr().String()
		return http.DefaultTransport.RoundTrip(req)
	})

	result, err := client.GetMarkdown(context.Background(), "http://example.com")

	require.NoError(t, err)
	assert.Empty(t, result)
}

// ---------------------------------------------------------------------------
// Helper: roundTripFunc lets us use a function as an http.RoundTripper to
// redirect requests from the hardcoded Jina base URL to our test server.
// ---------------------------------------------------------------------------

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}
