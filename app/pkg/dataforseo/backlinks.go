package dataforseo

import (
	"context"
	"encoding/json"
	"fmt"
)

// BacklinksSummary contains the backlink profile summary for a target.
type BacklinksSummary struct {
	Target                       string            `json:"target"`
	FirstSeen                    string            `json:"first_seen"`
	LostDate                     string            `json:"lost_date"`
	Rank                         int               `json:"rank"`
	Backlinks                    int64             `json:"backlinks"`
	BacklinksSpamScore           int               `json:"backlinks_spam_score"`
	CrawledPages                 int               `json:"crawled_pages"`
	InternalLinksCount           int               `json:"internal_links_count"`
	ExternalLinksCount           int               `json:"external_links_count"`
	BrokenBacklinks              int               `json:"broken_backlinks"`
	BrokenPages                  int               `json:"broken_pages"`
	ReferringDomains             int               `json:"referring_domains"`
	ReferringDomainsNofollow     int               `json:"referring_domains_nofollow"`
	ReferringMainDomains         int               `json:"referring_main_domains"`
	ReferringMainDomainsNofollow int               `json:"referring_main_domains_nofollow"`
	ReferringIPs                 int               `json:"referring_ips"`
	ReferringSubnets             int               `json:"referring_subnets"`
	ReferringPages               int               `json:"referring_pages"`
	ReferringPagesNofollow       int               `json:"referring_pages_nofollow"`
	ReferringLinksTLD            map[string]int    `json:"referring_links_tld"`
	ReferringLinksTypes          map[string]int    `json:"referring_links_types"`
	ReferringLinksAttributes     map[string]int    `json:"referring_links_attributes"`
	ReferringLinksPlatformTypes  map[string]int    `json:"referring_links_platform_types"`
	ReferringLinksCountries      map[string]int    `json:"referring_links_countries"`
	Info                         *BacklinksInfo    `json:"info"`
}

// BacklinksInfo contains meta-information about the target.
type BacklinksInfo struct {
	Server    string          `json:"server"`
	CMS       string          `json:"cms"`
	Platform  json.RawMessage `json:"platform_type"` // API returns string or array
	IP        string          `json:"ip_address"`
	Country   string          `json:"country"`
	SpamScore int             `json:"spam_score"`
}

// ReferringDomain represents a single referring domain.
type ReferringDomain struct {
	Type                         string         `json:"type"`
	Domain                       string         `json:"domain"`
	Rank                         int            `json:"rank"`
	Backlinks                    int64          `json:"backlinks"`
	FirstSeen                    string         `json:"first_seen"`
	LostDate                     string         `json:"lost_date"`
	BacklinksSpamScore           int            `json:"backlinks_spam_score"`
	BrokenBacklinks              int            `json:"broken_backlinks"`
	BrokenPages                  int            `json:"broken_pages"`
	ReferringDomains             int            `json:"referring_domains"`
	ReferringDomainsNofollow     int            `json:"referring_domains_nofollow"`
	ReferringMainDomains         int            `json:"referring_main_domains"`
	ReferringMainDomainsNofollow int            `json:"referring_main_domains_nofollow"`
	ReferringIPs                 int            `json:"referring_ips"`
	ReferringSubnets             int            `json:"referring_subnets"`
	ReferringPages               int            `json:"referring_pages"`
	ReferringPagesNofollow       int            `json:"referring_pages_nofollow"`
	ReferringLinksTypes          map[string]int `json:"referring_links_types"`
	ReferringLinksAttributes     map[string]int `json:"referring_links_attributes"`
	ReferringLinksPlatformTypes  map[string]int `json:"referring_links_platform_types"`
	ReferringLinksCountries      map[string]int `json:"referring_links_countries"`
}

// AnchorText represents an anchor text entry from the backlinks API.
type AnchorText struct {
	Anchor                       string         `json:"anchor"`
	Rank                         int            `json:"rank"`
	Backlinks                    int64          `json:"backlinks"`
	FirstSeen                    string         `json:"first_seen"`
	LostDate                     string         `json:"lost_date"`
	BacklinksSpamScore           int            `json:"backlinks_spam_score"`
	BrokenBacklinks              int            `json:"broken_backlinks"`
	BrokenPages                  int            `json:"broken_pages"`
	ReferringDomains             int            `json:"referring_domains"`
	ReferringDomainsNofollow     int            `json:"referring_domains_nofollow"`
	ReferringMainDomains         int            `json:"referring_main_domains"`
	ReferringIPs                 int            `json:"referring_ips"`
	ReferringSubnets             int            `json:"referring_subnets"`
	ReferringPages               int            `json:"referring_pages"`
	ReferringPagesNofollow       int            `json:"referring_pages_nofollow"`
	ReferringLinksTypes          map[string]int `json:"referring_links_types"`
	ReferringLinksAttributes     map[string]int `json:"referring_links_attributes"`
	ReferringLinksPlatformTypes  map[string]int `json:"referring_links_platform_types"`
	ReferringLinksCountries      map[string]int `json:"referring_links_countries"`
}

// backlinksSummaryRequest is the request body for backlinks/summary/live.
type backlinksSummaryRequest struct {
	Target string `json:"target"`
}

// GetBacklinksSummary retrieves the backlink summary for a target domain or URL.
func (c *Client) GetBacklinksSummary(ctx context.Context, target string) (*BacklinksSummary, error) {
	payload := []backlinksSummaryRequest{{Target: target}}
	resp, err := c.post(ctx, "/backlinks/summary/live", payload)
	if err != nil {
		return nil, err
	}
	var results []BacklinksSummary
	if err := c.firstResult(resp, &results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("dataforseo: empty backlinks summary result")
	}
	return &results[0], nil
}

// backlinksListRequest is the request body for paginated backlinks endpoints.
type backlinksListRequest struct {
	Target string `json:"target"`
	Limit  int    `json:"limit,omitempty"`
	Offset int    `json:"offset,omitempty"`
}

// backlinksReferringDomainsResult wraps the referring domains response.
type backlinksReferringDomainsResult struct {
	TotalCount int               `json:"total_count"`
	ItemsCount int               `json:"items_count"`
	Items      []ReferringDomain `json:"items"`
}

// GetReferringDomains retrieves the top referring domains for a target.
func (c *Client) GetReferringDomains(ctx context.Context, target string, limit, offset int) ([]ReferringDomain, error) {
	payload := []backlinksListRequest{{Target: target, Limit: limit, Offset: offset}}
	resp, err := c.post(ctx, "/backlinks/referring_domains/live", payload)
	if err != nil {
		return nil, err
	}
	var results []backlinksReferringDomainsResult
	if err := c.firstResult(resp, &results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, nil
	}
	return results[0].Items, nil
}

// backlinksAnchorsResult wraps the anchors response.
type backlinksAnchorsResult struct {
	TotalCount int          `json:"total_count"`
	ItemsCount int          `json:"items_count"`
	Items      []AnchorText `json:"items"`
}

// GetAnchors retrieves the anchor text distribution for a target.
func (c *Client) GetAnchors(ctx context.Context, target string, limit, offset int) ([]AnchorText, error) {
	payload := []backlinksListRequest{{Target: target, Limit: limit, Offset: offset}}
	resp, err := c.post(ctx, "/backlinks/anchors/live", payload)
	if err != nil {
		return nil, err
	}
	var results []backlinksAnchorsResult
	if err := c.firstResult(resp, &results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, nil
	}
	return results[0].Items, nil
}
