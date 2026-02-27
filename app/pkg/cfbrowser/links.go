package cfbrowser

import (
	"context"
	"encoding/json"
	"fmt"
)

// LinksRequest is the request payload for the links endpoint.
type LinksRequest struct {
	URL string `json:"url"`
}

// Link represents a single extracted link.
type Link struct {
	URL  string `json:"url"`
	Text string `json:"text"`
}

// LinksResponse is the response from the links endpoint.
type LinksResponse struct {
	Links []Link `json:"links"`
}

// GetLinks fetches a URL and returns all extracted links.
func (c *Client) GetLinks(ctx context.Context, targetURL string) (*LinksResponse, error) {
	data, err := c.doRequest(ctx, "/links", LinksRequest{URL: targetURL})
	if err != nil {
		return nil, err
	}

	var resp LinksResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("cfbrowser: decode links response: %w", err)
	}
	return &resp, nil
}
