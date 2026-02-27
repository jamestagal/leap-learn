package cfbrowser

import (
	"context"
	"encoding/json"
	"fmt"
)

// ScrapeRequest is the request payload for the scrape endpoint.
type ScrapeRequest struct {
	URL       string            `json:"url"`
	Selectors map[string]string `json:"selectors"`
}

// ScrapeResponse is the response from the scrape endpoint.
type ScrapeResponse struct {
	Data map[string]string `json:"data"`
	URL  string            `json:"url"`
}

// Scrape fetches a URL and extracts text from the given CSS selectors.
func (c *Client) Scrape(ctx context.Context, targetURL string, selectors map[string]string) (*ScrapeResponse, error) {
	data, err := c.doRequest(ctx, "/scrape", ScrapeRequest{URL: targetURL, Selectors: selectors})
	if err != nil {
		return nil, err
	}

	var resp ScrapeResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("cfbrowser: decode scrape response: %w", err)
	}
	return &resp, nil
}
