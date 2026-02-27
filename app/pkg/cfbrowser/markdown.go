package cfbrowser

import (
	"context"
	"encoding/json"
	"fmt"
)

// MarkdownRequest is the request payload for the markdown endpoint.
type MarkdownRequest struct {
	URL string `json:"url"`
}

// MarkdownResponse is the response from the markdown endpoint.
type MarkdownResponse struct {
	Content string `json:"content"`
	Title   string `json:"title"`
	URL     string `json:"url"`
}

// GetMarkdown fetches a URL and returns its content as clean, LLM-ready markdown.
func (c *Client) GetMarkdown(ctx context.Context, targetURL string) (*MarkdownResponse, error) {
	data, err := c.doRequest(ctx, "/markdown", MarkdownRequest{URL: targetURL})
	if err != nil {
		return nil, err
	}

	var resp MarkdownResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("cfbrowser: decode markdown response: %w", err)
	}
	return &resp, nil
}
