// Package pagespeed provides a client for Google PageSpeed Insights API v5.
// It extracts Lighthouse category scores, Core Web Vitals, and recommendations.
package pagespeed

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"time"
)

const apiBaseURL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

// Client calls the Google PageSpeed Insights API.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new PageSpeed client with the given API key.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 90 * time.Second, // PageSpeed can take a while
		},
	}
}

// --- Result types (stored as JSONB in seo_audits.performance_data) ---

// WebVitalMetric is a single Core Web Vital measurement.
type WebVitalMetric struct {
	Value    string `json:"value"`    // Formatted: "1.2s", "0.01", "120ms"
	Category string `json:"category"` // "good", "needs-improvement", "poor"
}

// Result is the structured output stored in the database.
type Result struct {
	Performance   int                       `json:"performance"`   // 0-100
	Accessibility int                       `json:"accessibility"` // 0-100
	BestPractices int                       `json:"bestPractices"` // 0-100
	SEO           int                       `json:"seo"`           // 0-100
	LoadTime      string                    `json:"loadTime"`      // LCP formatted value
	Metrics       map[string]WebVitalMetric `json:"metrics"`       // LCP, CLS, FCP, TBT, SI
	Recs          []string                  `json:"recommendations"`
	AuditedURL    string                    `json:"auditedUrl"`
	AuditedAt     string                    `json:"auditedAt"`
}

// --- Google API response types ---

type apiResponse struct {
	LighthouseResult *lighthouseResult `json:"lighthouseResult"`
	Error            *apiError         `json:"error"`
}

type apiError struct {
	Message string `json:"message"`
}

type lighthouseResult struct {
	Categories map[string]categoryScore  `json:"categories"`
	Audits     map[string]lighthouseAudit `json:"audits"`
}

type categoryScore struct {
	Score float64 `json:"score"` // 0.0–1.0
}

type lighthouseAudit struct {
	ID           string        `json:"id"`
	Title        string        `json:"title"`
	Score        *float64      `json:"score"`
	DisplayValue string        `json:"displayValue"`
	NumericValue *float64      `json:"numericValue"`
	Details      *auditDetails `json:"details"`
}

type auditDetails struct {
	Type string `json:"type"`
}

// --- Thresholds matching the TS service ---

type threshold struct {
	good             float64
	needsImprovement float64
}

var thresholds = map[string]threshold{
	"largest-contentful-paint": {good: 2.5, needsImprovement: 4.0},
	"cumulative-layout-shift":  {good: 0.1, needsImprovement: 0.25},
	"first-contentful-paint":   {good: 1.8, needsImprovement: 3.0},
	"total-blocking-time":      {good: 200, needsImprovement: 600}, // ms
	"speed-index":              {good: 3.4, needsImprovement: 5.8},
}

// --- Public API ---

// Run fetches PageSpeed data for the given URL using the specified strategy ("mobile" or "desktop").
func (c *Client) Run(ctx context.Context, targetURL, strategy string) (*Result, error) {
	if strategy == "" {
		strategy = "mobile"
	}

	u, err := url.Parse(apiBaseURL)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("url", targetURL)
	q.Set("strategy", strategy)
	q.Set("key", c.apiKey)
	q.Add("category", "performance")
	q.Add("category", "accessibility")
	q.Add("category", "best-practices")
	q.Add("category", "seo")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pagespeed request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pagespeed API returned %d: %s", resp.StatusCode, truncate(string(body), 200))
	}

	var apiResp apiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	if apiResp.Error != nil {
		return nil, fmt.Errorf("pagespeed API error: %s", apiResp.Error.Message)
	}

	if apiResp.LighthouseResult == nil {
		return nil, fmt.Errorf("missing lighthouseResult in response")
	}

	return parseResult(apiResp.LighthouseResult, targetURL), nil
}

// --- Parsing ---

func parseResult(lr *lighthouseResult, targetURL string) *Result {
	r := &Result{
		Performance:   categoryScoreInt(lr.Categories, "performance"),
		Accessibility: categoryScoreInt(lr.Categories, "accessibility"),
		BestPractices: categoryScoreInt(lr.Categories, "best-practices"),
		SEO:           categoryScoreInt(lr.Categories, "seo"),
		Metrics:       make(map[string]WebVitalMetric),
		AuditedURL:    targetURL,
		AuditedAt:     time.Now().UTC().Format(time.RFC3339),
	}

	// Core Web Vitals
	r.Metrics["LCP"] = parseMetric(lr.Audits, "largest-contentful-paint", "s", 1000)
	r.Metrics["CLS"] = parseMetric(lr.Audits, "cumulative-layout-shift", "", 0)
	r.Metrics["FCP"] = parseMetric(lr.Audits, "first-contentful-paint", "s", 1000)
	r.Metrics["TBT"] = parseMetric(lr.Audits, "total-blocking-time", "ms", 0)
	r.Metrics["SI"] = parseMetric(lr.Audits, "speed-index", "s", 1000)

	// Load time from LCP
	if lcp, ok := r.Metrics["LCP"]; ok {
		r.LoadTime = lcp.Value
	}

	// Extract recommendations (opportunities with score < 1)
	r.Recs = extractRecommendations(lr.Audits, 5)

	return r
}

func categoryScoreInt(cats map[string]categoryScore, key string) int {
	if cs, ok := cats[key]; ok {
		return int(math.Round(cs.Score * 100))
	}
	return 0
}

func parseMetric(audits map[string]lighthouseAudit, auditID, unit string, msDivisor float64) WebVitalMetric {
	audit, ok := audits[auditID]
	if !ok || audit.NumericValue == nil {
		return WebVitalMetric{Value: "N/A", Category: "poor"}
	}

	rawValue := *audit.NumericValue

	// Normalize: convert ms to seconds for time-based metrics
	displayValue := rawValue
	if msDivisor > 0 && rawValue > msDivisor {
		displayValue = rawValue / msDivisor
	}

	// Format value
	var formatted string
	switch unit {
	case "s":
		formatted = fmt.Sprintf("%.1fs", displayValue)
	case "ms":
		formatted = fmt.Sprintf("%.0fms", rawValue)
	default:
		formatted = fmt.Sprintf("%.2f", displayValue)
	}

	// Categorize
	cat := categorize(auditID, rawValue, msDivisor)

	return WebVitalMetric{
		Value:    formatted,
		Category: cat,
	}
}

func categorize(auditID string, rawValue, msDivisor float64) string {
	t, ok := thresholds[auditID]
	if !ok {
		return "poor"
	}

	// For time-based metrics stored in ms, compare in the same unit as thresholds.
	compareValue := rawValue
	if msDivisor > 0 && auditID != "total-blocking-time" {
		// Thresholds for LCP, FCP, SI are in seconds; rawValue is in ms.
		compareValue = rawValue / msDivisor
	}

	if compareValue <= t.good {
		return "good"
	}
	if compareValue <= t.needsImprovement {
		return "needs-improvement"
	}
	return "poor"
}

func extractRecommendations(audits map[string]lighthouseAudit, limit int) []string {
	type scored struct {
		title string
		score float64
	}

	var opps []scored
	for _, audit := range audits {
		if audit.Details != nil && audit.Details.Type == "opportunity" &&
			audit.Score != nil && *audit.Score < 1 && audit.DisplayValue != "" {
			opps = append(opps, scored{title: audit.Title, score: *audit.Score})
		}
	}

	sort.Slice(opps, func(i, j int) bool { return opps[i].score < opps[j].score })

	var result []string
	for i, o := range opps {
		if i >= limit {
			break
		}
		result = append(result, o.title)
	}
	return result
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
