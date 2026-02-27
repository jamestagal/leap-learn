package dataforseo

import (
	"context"
	"encoding/json"
	"fmt"
)

// OnPageTaskPostRequest contains parameters for creating an on-page audit task.
type OnPageTaskPostRequest struct {
	Target                string `json:"target"`
	MaxCrawlPages         int    `json:"max_crawl_pages,omitempty"`
	StartURL              string `json:"start_url,omitempty"`
	MaxCrawlDepth         int    `json:"max_crawl_depth,omitempty"`
	EnableSitemap         bool   `json:"enable_sitemap_checking,omitempty"`
	EnableJavascript      bool   `json:"enable_javascript,omitempty"`
	LoadResources         bool   `json:"load_resources,omitempty"`
	AllowSubdomains       bool   `json:"allow_subdomains,omitempty"`
	EnableBrowserRendering bool  `json:"enable_browser_rendering,omitempty"`
	Tag                   string `json:"tag,omitempty"`
}

// OnPageSummary contains the result of an on-page audit summary.
type OnPageSummary struct {
	CrawlProgress       string              `json:"crawl_progress"`
	CrawlStatus         *OnPageCrawlStatus  `json:"crawl_status"`
	CrawlGatewayAddress string              `json:"crawl_gateway_address"`
	CrawlStopReason     string              `json:"crawl_stop_reason"`
	DomainInfo          *OnPageDomainInfo   `json:"domain_info"`
	PageMetrics         *OnPagePageMetrics  `json:"page_metrics"`
}

// OnPageCrawlStatus tracks crawl progress.
type OnPageCrawlStatus struct {
	MaxCrawlPages int `json:"max_crawl_pages"`
	PagesInQueue  int `json:"pages_in_queue"`
	PagesCrawled  int `json:"pages_crawled"`
}

// OnPageDomainInfo contains domain-level information from the audit.
type OnPageDomainInfo struct {
	Name         string          `json:"name"`
	CMS          string          `json:"cms"`
	IP           string          `json:"ip"`
	Server       string          `json:"server"`
	CrawlStart   string          `json:"crawl_start"`
	CrawlEnd     string          `json:"crawl_end"`
	SSLInfo      *OnPageSSLInfo  `json:"ssl_info"`
	Checks       map[string]bool `json:"checks"`
	TotalPages   int             `json:"total_pages"`
	PageNotFound json.RawMessage `json:"page_not_found_status_code"` // API returns number, array, or null
}

// OnPageSSLInfo contains SSL certificate details.
type OnPageSSLInfo struct {
	ValidCertificate   bool            `json:"valid_certificate"`
	CertificateIssuer  string          `json:"certificate_issuer"`
	CertificateSubject string          `json:"certificate_subject"`
	CertificateVersion json.RawMessage `json:"certificate_version"` // API returns string or number
	CertificateHash    string          `json:"certificate_hash"`
	CertificateExpDate string          `json:"certificate_expiration_date"`
}

// OnPagePageMetrics contains aggregated page-level metrics.
type OnPagePageMetrics struct {
	OnPageScore        float64         `json:"onpage_score"`
	TotalPages         int             `json:"total_pages"`
	DuplicateTitle     int             `json:"duplicate_title"`
	DuplicateDescription int           `json:"duplicate_description"`
	DuplicateContent   int             `json:"duplicate_content"`
	BrokenLinks        int             `json:"broken_links"`
	BrokenResources    int             `json:"broken_resources"`
	LinksExternal      int             `json:"links_external"`
	LinksInternal      int             `json:"links_internal"`
	NonIndexable       int             `json:"non_indexable"`
	Checks             map[string]int  `json:"checks"`
}

// OnPagePage represents a single crawled page from the on-page audit.
type OnPagePage struct {
	ResourceType    string                 `json:"resource_type"`
	StatusCode      int                    `json:"status_code"`
	URL             string                 `json:"url"`
	Size            int                    `json:"size"`
	OnPageScore     float64                `json:"onpage_score"`
	TotalDOM        int                    `json:"total_dom_size"`
	EncodedSize     int                    `json:"encoded_size"`
	ClickDepth      int                    `json:"click_depth"`
	BrokenResources bool                   `json:"broken_resources"`
	Meta            *OnPagePageMeta        `json:"meta"`
	PageTiming      *OnPagePageTiming      `json:"page_timing"`
	Checks          map[string]bool        `json:"checks"`
	CacheControl    map[string]interface{} `json:"cache_control"`
}

// OnPagePageMeta contains metadata for a crawled page.
type OnPagePageMeta struct {
	Title              string              `json:"title"`
	Description        string              `json:"description"`
	Charset            json.RawMessage     `json:"charset"` // API returns string or number
	Favicon            string              `json:"favicon"`
	Canonical          string              `json:"canonical"`
	InternalLinksCount int                 `json:"internal_links_count"`
	ExternalLinksCount int                 `json:"external_links_count"`
	InboundLinksCount  int                 `json:"inbound_links_count"`
	ImagesCount        int                 `json:"images_count"`
	ImagesSize         int                 `json:"images_size"`
	Content            *OnPageContentMeta  `json:"content"`
	HTags              map[string][]string `json:"htags"`
}

// WordCount returns the plain text word count from the nested content object.
// Returns 0 if content metadata is not available.
func (m *OnPagePageMeta) WordCount() int {
	if m.Content == nil {
		return 0
	}
	return m.Content.PlainTextWordCount
}

// OnPageContentMeta contains content-level metadata from DataForSEO's on-page analysis.
// This is a nested object within the page meta: meta.content.plain_text_word_count, etc.
type OnPageContentMeta struct {
	PlainTextWordCount int `json:"plain_text_word_count"`
	PlainTextSize      int `json:"plain_text_size"`
	AutomatedReadability float64 `json:"automated_readability_index"`
	ColemanLiau        float64 `json:"coleman_liau_readability_index"`
	DaleChall          float64 `json:"dale_chall_readability_index"`
	FleschKincaid      float64 `json:"flesch_kincaid_readability_index"`
	SmogReadability    float64 `json:"smog_readability_index"`
}

// OnPagePageTiming contains page load timing metrics.
type OnPagePageTiming struct {
	TimeToInteractive float64 `json:"time_to_interactive"`
	DOMComplete       float64 `json:"dom_complete"`
	LargestContentfulPaint float64 `json:"largest_contentful_paint"`
	FirstInputDelay   float64 `json:"first_input_delay"`
	ConnectionTime    float64 `json:"connection_time"`
	TimeToSecureConnection float64 `json:"time_to_secure_connection"`
	RequestSentTime   float64 `json:"request_sent_time"`
	WaitingTime       float64 `json:"waiting_time"`
	DownloadTime      float64 `json:"download_time"`
	DurationTime      float64 `json:"duration_time"`
}

// CreateOnPageTask creates an on-page audit task. Returns the task ID.
func (c *Client) CreateOnPageTask(ctx context.Context, req OnPageTaskPostRequest) (string, error) {
	resp, err := c.post(ctx, "/on_page/task_post", []OnPageTaskPostRequest{req})
	if err != nil {
		return "", err
	}
	if len(resp.Tasks) == 0 {
		return "", fmt.Errorf("dataforseo: no tasks in response")
	}
	task := resp.Tasks[0]
	// 20000 = Ok, 20100 = Task Created (async task accepted)
	if task.StatusCode != 20000 && task.StatusCode != 20100 {
		return "", fmt.Errorf("dataforseo: task error %d: %s", task.StatusCode, task.StatusMessage)
	}
	return task.ID, nil
}

// GetOnPageSummary retrieves the summary of an on-page audit task.
// Returns ErrTaskNotReady if the task hasn't been processed yet.
// Uses GET as per DataForSEO docs: GET /v3/on_page/summary/{task_id}
func (c *Client) GetOnPageSummary(ctx context.Context, taskID string) (*OnPageSummary, error) {
	resp, err := c.getRaw(ctx, "/on_page/summary/"+taskID)
	if err != nil {
		return nil, err
	}
	// 40400 = Not Found — task is still being processed
	if resp.StatusCode == 40400 {
		return nil, ErrTaskNotReady
	}
	if resp.StatusCode != 20000 {
		return nil, fmt.Errorf("dataforseo: API error %d: %s", resp.StatusCode, resp.StatusMessage)
	}
	var results []OnPageSummary
	if err := c.firstResult(resp, &results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("dataforseo: empty on-page summary result")
	}
	return &results[0], nil
}

// onPagePagesRequest is the request body for the on_page/pages endpoint.
type onPagePagesRequest struct {
	ID     string `json:"id"`
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
}

// onPagePagesResult wraps the paginated pages response.
type onPagePagesResult struct {
	CrawlProgress string       `json:"crawl_progress"`
	ItemsCount    int          `json:"items_count"`
	Items         []OnPagePage `json:"items"`
}

// GetOnPagePages retrieves crawled pages from an on-page audit task.
// Returns the pages, total count, and any error.
func (c *Client) GetOnPagePages(ctx context.Context, taskID string, limit, offset int) ([]OnPagePage, int, error) {
	payload := []onPagePagesRequest{{ID: taskID, Limit: limit, Offset: offset}}
	resp, err := c.post(ctx, "/on_page/pages", payload)
	if err != nil {
		return nil, 0, err
	}
	var results []onPagePagesResult
	if err := c.firstResult(resp, &results); err != nil {
		return nil, 0, err
	}
	if len(results) == 0 {
		return nil, 0, nil
	}
	return results[0].Items, results[0].ItemsCount, nil
}
