package h5p

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultHubURL    = "https://hub-api.h5p.org"
	hubContentTypes  = "/v1/content-types/"
	hubCacheTTL      = 24 * time.Hour
	hubCacheKey      = "content-type-cache"
	downloadTimeout  = 5 * time.Minute
)

// HubClient handles communication with the H5P Hub API
type HubClient struct {
	hubURL     string
	httpClient *http.Client
}

// NewHubClient creates a new Hub API client
func NewHubClient(hubURL string) *HubClient {
	if hubURL == "" {
		hubURL = defaultHubURL
	}
	return &HubClient{
		hubURL: hubURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// FetchContentTypes fetches the content type list from the H5P Hub
func (c *HubClient) FetchContentTypes() (*HubResponse, error) {
	form := url.Values{}
	form.Set("uuid", "leaplearn-platform")
	form.Set("platform_name", "LeapLearn")
	form.Set("platform_version", "1.0")
	form.Set("h5p_version", "1.26")
	form.Set("type", "local")
	form.Set("core_api_version", "1.26")

	req, err := http.NewRequest(http.MethodPost, c.hubURL+hubContentTypes, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("creating hub request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching content types from hub: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("hub returned status %d: %s", resp.StatusCode, string(body))
	}

	var hubResp HubResponse
	if err := json.NewDecoder(resp.Body).Decode(&hubResp); err != nil {
		return nil, fmt.Errorf("decoding hub response: %w", err)
	}

	return &hubResp, nil
}

// DownloadPackage downloads an .h5p package for a given machine name
func (c *HubClient) DownloadPackage(machineName string) ([]byte, error) {
	client := &http.Client{Timeout: downloadTimeout}

	downloadURL := fmt.Sprintf("%s/v1/content-types/%s", c.hubURL, machineName)
	resp, err := client.Get(downloadURL)
	if err != nil {
		return nil, fmt.Errorf("downloading package %s: %w", machineName, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("hub returned status %d for package %s", resp.StatusCode, machineName)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading package data for %s: %w", machineName, err)
	}

	return data, nil
}
