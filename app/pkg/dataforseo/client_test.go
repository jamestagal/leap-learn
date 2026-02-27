package dataforseo

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// wrapResponse builds a full DataForSEO JSON response envelope around the
// given result payload (which is already marshalled into the first task).
func wrapResponse(result json.RawMessage) []byte {
	resp := Response{
		Version:       "0.1",
		StatusCode:    20000,
		StatusMessage: "Ok.",
		Time:          "0.05 sec.",
		Cost:          0.01,
		TasksCount:    1,
		TasksError:    0,
		Tasks: []Task{{
			ID:            "01234567-0123-0123-0123-0123456789ab",
			StatusCode:    20000,
			StatusMessage: "Ok.",
			Time:          "0.04 sec.",
			Cost:          0.01,
			ResultCount:   1,
			Path:          []string{"v3", "test"},
			Data:          json.RawMessage(`{}`),
			Result:        result,
		}},
	}
	b, _ := json.Marshal(resp)
	return b
}

// wrapErrorResponse builds a response with a non-20000 status code.
func wrapErrorResponse(code int, msg string) []byte {
	resp := Response{
		Version:       "0.1",
		StatusCode:    code,
		StatusMessage: msg,
		Time:          "0.01 sec.",
		TasksCount:    0,
		TasksError:    0,
		Tasks:         nil,
	}
	b, _ := json.Marshal(resp)
	return b
}

// wrapEmptyTasksResponse builds a response with StatusCode 20000 but empty Tasks.
func wrapEmptyTasksResponse() []byte {
	resp := Response{
		Version:       "0.1",
		StatusCode:    20000,
		StatusMessage: "Ok.",
		Time:          "0.01 sec.",
		TasksCount:    0,
		TasksError:    0,
		Tasks:         []Task{},
	}
	b, _ := json.Marshal(resp)
	return b
}

// newTestServer creates an httptest.Server plus a Client pointed at it.
func newTestServer(t *testing.T, handler http.HandlerFunc) (*httptest.Server, *Client) {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	client := NewClient("testlogin", "testpass", WithBaseURL(srv.URL))
	return srv, client
}

// ---------------------------------------------------------------------------
// Client construction tests
// ---------------------------------------------------------------------------

func TestNewClient_Defaults(t *testing.T) {
	c := NewClient("user", "pass")
	assert.Equal(t, defaultBaseURL, c.baseURL)
	assert.Equal(t, "Basic "+base64.StdEncoding.EncodeToString([]byte("user:pass")), c.authHeader)
	assert.NotNil(t, c.httpClient)
	assert.Equal(t, 30*time.Second, c.httpClient.Timeout)
	// default concurrency is 5
	assert.Equal(t, 5, cap(c.sem))
}

func TestNewClient_WithOptions(t *testing.T) {
	c := NewClient("u", "p",
		WithBaseURL("https://custom.api"),
		WithTimeout(10*time.Second),
		WithMaxConcurrent(2),
	)
	assert.Equal(t, "https://custom.api", c.baseURL)
	assert.Equal(t, 10*time.Second, c.httpClient.Timeout)
	assert.Equal(t, 2, cap(c.sem))
}

// ---------------------------------------------------------------------------
// post() behaviour tests
// ---------------------------------------------------------------------------

func TestPost_BasicAuth(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		// Verify Authorization header
		auth := r.Header.Get("Authorization")
		expected := "Basic " + base64.StdEncoding.EncodeToString([]byte("testlogin:testpass"))
		assert.Equal(t, expected, auth)

		// Verify Content-Type
		assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

		// Verify method
		assert.Equal(t, http.MethodPost, r.Method)

		// Return a valid response
		w.WriteHeader(http.StatusOK)
		w.Write(wrapResponse(json.RawMessage(`[]`)))
	})

	ctx := context.Background()
	resp, err := client.post(ctx, "/test", map[string]string{"key": "value"})
	require.NoError(t, err)
	assert.Equal(t, 20000, resp.StatusCode)
}

func TestPost_ErrorResponse(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write(wrapErrorResponse(40001, "You are not authorized"))
	})

	ctx := context.Background()
	_, err := client.post(ctx, "/test", nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "API error 40001")
	assert.Contains(t, err.Error(), "You are not authorized")
}

func TestPost_HTTP4xxError(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`bad request`))
	})

	ctx := context.Background()
	_, err := client.post(ctx, "/test", nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 400")
}

// ---------------------------------------------------------------------------
// OnPage tests
// ---------------------------------------------------------------------------

func TestCreateOnPageTask_Success(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/on_page/task_post")

		// Verify request body is an array
		body, _ := io.ReadAll(r.Body)
		var reqs []OnPageTaskPostRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "example.com", reqs[0].Target)
		assert.Equal(t, 100, reqs[0].MaxCrawlPages)

		resp := Response{
			Version:       "0.1",
			StatusCode:    20000,
			StatusMessage: "Ok.",
			Time:          "0.05 sec.",
			TasksCount:    1,
			Tasks: []Task{{
				ID:            "task-abc-123",
				StatusCode:    20000,
				StatusMessage: "Ok.",
				Time:          "0.01 sec.",
			}},
		}
		b, _ := json.Marshal(resp)
		w.Write(b)
	})

	ctx := context.Background()
	taskID, err := client.CreateOnPageTask(ctx, OnPageTaskPostRequest{
		Target:        "example.com",
		MaxCrawlPages: 100,
	})
	require.NoError(t, err)
	assert.Equal(t, "task-abc-123", taskID)
}

func TestGetOnPageSummary_Success(t *testing.T) {
	summaryResult := []OnPageSummary{{
		CrawlProgress: "finished",
		CrawlStatus: &OnPageCrawlStatus{
			MaxCrawlPages: 500,
			PagesInQueue:  0,
			PagesCrawled:  42,
		},
		DomainInfo: &OnPageDomainInfo{
			Name:       "example.com",
			CMS:        "WordPress",
			IP:         "1.2.3.4",
			TotalPages: 42,
		},
		PageMetrics: &OnPagePageMetrics{
			OnPageScore: 78.5,
			TotalPages:  42,
			BrokenLinks: 3,
		},
	}}

	result, _ := json.Marshal(summaryResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/on_page/summary/")
		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	summary, err := client.GetOnPageSummary(ctx, "task-abc-123")
	require.NoError(t, err)
	require.NotNil(t, summary)
	assert.Equal(t, "finished", summary.CrawlProgress)
	assert.Equal(t, 42, summary.CrawlStatus.PagesCrawled)
	assert.Equal(t, "WordPress", summary.DomainInfo.CMS)
	assert.Equal(t, 78.5, summary.PageMetrics.OnPageScore)
	assert.Equal(t, 3, summary.PageMetrics.BrokenLinks)
}

func TestGetOnPagePages_Success(t *testing.T) {
	pagesResult := []onPagePagesResult{{
		CrawlProgress: "finished",
		ItemsCount:    2,
		Items: []OnPagePage{
			{
				ResourceType: "html",
				StatusCode:   200,
				URL:          "https://example.com/",
				OnPageScore:  85.0,
				Size:         12345,
				Meta: &OnPagePageMeta{
					Title:       "Example Home",
					Description: "Home page description",
				},
				PageTiming: &OnPagePageTiming{
					TimeToInteractive:      1.2,
					LargestContentfulPaint: 2.5,
				},
			},
			{
				ResourceType: "html",
				StatusCode:   200,
				URL:          "https://example.com/about",
				OnPageScore:  72.3,
				Size:         8901,
			},
		},
	}}

	result, _ := json.Marshal(pagesResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/on_page/pages")

		// Verify pagination params in request body
		body, _ := io.ReadAll(r.Body)
		var reqs []onPagePagesRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "task-id", reqs[0].ID)
		assert.Equal(t, 10, reqs[0].Limit)
		assert.Equal(t, 20, reqs[0].Offset)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	pages, total, err := client.GetOnPagePages(ctx, "task-id", 10, 20)
	require.NoError(t, err)
	assert.Equal(t, 2, total)
	require.Len(t, pages, 2)
	assert.Equal(t, "https://example.com/", pages[0].URL)
	assert.Equal(t, 85.0, pages[0].OnPageScore)
	assert.Equal(t, "Example Home", pages[0].Meta.Title)
	assert.Equal(t, 2.5, pages[0].PageTiming.LargestContentfulPaint)
	assert.Equal(t, "https://example.com/about", pages[1].URL)
}

// ---------------------------------------------------------------------------
// Backlinks tests
// ---------------------------------------------------------------------------

func TestGetBacklinksSummary_Success(t *testing.T) {
	summaryResult := []BacklinksSummary{{
		Target:           "example.com",
		Rank:             450,
		Backlinks:        12345,
		ReferringDomains: 678,
		BrokenBacklinks:  12,
		Info: &BacklinksInfo{
			Server:  "nginx",
			CMS:     "WordPress",
			Country: "US",
		},
		ReferringLinksTLD: map[string]int{
			"com": 500,
			"org": 100,
		},
	}}

	result, _ := json.Marshal(summaryResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/backlinks/summary/live")

		body, _ := io.ReadAll(r.Body)
		var reqs []backlinksSummaryRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "example.com", reqs[0].Target)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	summary, err := client.GetBacklinksSummary(ctx, "example.com")
	require.NoError(t, err)
	require.NotNil(t, summary)
	assert.Equal(t, "example.com", summary.Target)
	assert.Equal(t, int64(12345), summary.Backlinks)
	assert.Equal(t, 678, summary.ReferringDomains)
	assert.Equal(t, 12, summary.BrokenBacklinks)
	assert.Equal(t, "nginx", summary.Info.Server)
	assert.Equal(t, 500, summary.ReferringLinksTLD["com"])
}

func TestGetReferringDomains_Success(t *testing.T) {
	domainsResult := []backlinksReferringDomainsResult{{
		TotalCount: 100,
		ItemsCount: 2,
		Items: []ReferringDomain{
			{
				Type:             "referring_domain",
				Domain:           "blog.example.org",
				Rank:             320,
				Backlinks:        55,
				ReferringDomains: 10,
			},
			{
				Type:             "referring_domain",
				Domain:           "news.example.net",
				Rank:             450,
				Backlinks:        23,
				ReferringDomains: 5,
			},
		},
	}}

	result, _ := json.Marshal(domainsResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/backlinks/referring_domains/live")

		body, _ := io.ReadAll(r.Body)
		var reqs []backlinksListRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "example.com", reqs[0].Target)
		assert.Equal(t, 10, reqs[0].Limit)
		assert.Equal(t, 0, reqs[0].Offset)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	domains, err := client.GetReferringDomains(ctx, "example.com", 10, 0)
	require.NoError(t, err)
	require.Len(t, domains, 2)
	assert.Equal(t, "blog.example.org", domains[0].Domain)
	assert.Equal(t, int64(55), domains[0].Backlinks)
	assert.Equal(t, "news.example.net", domains[1].Domain)
}

func TestGetAnchors_Success(t *testing.T) {
	anchorsResult := []backlinksAnchorsResult{{
		TotalCount: 50,
		ItemsCount: 2,
		Items: []AnchorText{
			{
				Anchor:           "example brand",
				Rank:             200,
				Backlinks:        30,
				ReferringDomains: 15,
			},
			{
				Anchor:           "click here",
				Rank:             100,
				Backlinks:        10,
				ReferringDomains: 8,
			},
		},
	}}

	result, _ := json.Marshal(anchorsResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/backlinks/anchors/live")

		body, _ := io.ReadAll(r.Body)
		var reqs []backlinksListRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "example.com", reqs[0].Target)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	anchors, err := client.GetAnchors(ctx, "example.com", 10, 0)
	require.NoError(t, err)
	require.Len(t, anchors, 2)
	assert.Equal(t, "example brand", anchors[0].Anchor)
	assert.Equal(t, int64(30), anchors[0].Backlinks)
	assert.Equal(t, "click here", anchors[1].Anchor)
}

// ---------------------------------------------------------------------------
// Keywords tests
// ---------------------------------------------------------------------------

func TestGetSearchVolume_Success(t *testing.T) {
	sv := 1000
	ci := 85
	cpc := 2.50
	lowBid := 1.20
	highBid := 4.80

	kwResult := []keywordSearchVolumeResult{{
		ItemsCount: 2,
		Items: []KeywordData{
			{
				Keyword:          "web design",
				LocationCode:     2840,
				LanguageCode:     "en",
				Competition:      "HIGH",
				CompetitionIndex: &ci,
				SearchVolume:     &sv,
				CPC:              &cpc,
				LowTopOfPageBid:  &lowBid,
				HighTopOfPageBid: &highBid,
				MonthlySearches: []MonthlySearch{
					{Year: 2025, Month: 12, SearchVolume: 1100},
					{Year: 2025, Month: 11, SearchVolume: 950},
				},
			},
			{
				Keyword:      "web development",
				LocationCode: 2840,
				LanguageCode: "en",
				Competition:  "MEDIUM",
				SearchVolume: &sv,
			},
		},
	}}

	result, _ := json.Marshal(kwResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/keywords_data/google_ads/search_volume/live")

		body, _ := io.ReadAll(r.Body)
		var reqs []KeywordSearchVolumeRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, []string{"web design", "web development"}, reqs[0].Keywords)
		assert.Equal(t, 2840, reqs[0].LocationCode)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	keywords, err := client.GetSearchVolume(ctx, KeywordSearchVolumeRequest{
		Keywords:     []string{"web design", "web development"},
		LocationCode: 2840,
		LanguageCode: "en",
	})
	require.NoError(t, err)
	require.Len(t, keywords, 2)
	assert.Equal(t, "web design", keywords[0].Keyword)
	assert.Equal(t, 1000, *keywords[0].SearchVolume)
	assert.Equal(t, "HIGH", keywords[0].Competition)
	assert.Equal(t, 2.50, *keywords[0].CPC)
	require.Len(t, keywords[0].MonthlySearches, 2)
	assert.Equal(t, 2025, keywords[0].MonthlySearches[0].Year)
	assert.Equal(t, 1100, keywords[0].MonthlySearches[0].SearchVolume)
}

// ---------------------------------------------------------------------------
// Labs tests
// ---------------------------------------------------------------------------

func TestGetKeywordSuggestions_Success(t *testing.T) {
	sv := 500
	comp := 0.65
	cpc := 1.50
	kd := 42

	suggestionsResult := []keywordSuggestionsResult{{
		SEType:     "google",
		Seed:       "seo tools",
		TotalCount: 100,
		ItemsCount: 2,
		Items: []KeywordSuggestion{
			{
				SEType:       "google",
				Keyword:      "seo tools free",
				LocationCode: 2840,
				LanguageCode: "en",
				KeywordInfo: KeywordInfo{
					SearchVolume:     &sv,
					Competition:      &comp,
					CompetitionLevel: "MEDIUM",
					CPC:              &cpc,
				},
				KeywordProperties: KeywordProperties{
					CoreKeyword:       "seo tools",
					KeywordDifficulty: &kd,
					WordCount:         3,
				},
				SearchIntentInfo: &SearchIntentInfo{
					MainIntent: "informational",
				},
			},
			{
				SEType:       "google",
				Keyword:      "best seo tools",
				LocationCode: 2840,
				LanguageCode: "en",
				KeywordInfo: KeywordInfo{
					SearchVolume:     &sv,
					CompetitionLevel: "HIGH",
				},
			},
		},
	}}

	result, _ := json.Marshal(suggestionsResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/dataforseo_labs/google/keyword_suggestions/live")

		body, _ := io.ReadAll(r.Body)
		var reqs []keywordSuggestionsRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "seo tools", reqs[0].Keyword)
		assert.Equal(t, 2840, reqs[0].LocationCode)
		assert.Equal(t, "en", reqs[0].LanguageCode)
		assert.Equal(t, 50, reqs[0].Limit)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	suggestions, err := client.GetKeywordSuggestions(ctx, "seo tools", 2840, "en", 50)
	require.NoError(t, err)
	require.Len(t, suggestions, 2)
	assert.Equal(t, "seo tools free", suggestions[0].Keyword)
	assert.Equal(t, 500, *suggestions[0].KeywordInfo.SearchVolume)
	assert.Equal(t, "MEDIUM", suggestions[0].KeywordInfo.CompetitionLevel)
	assert.Equal(t, 42, *suggestions[0].KeywordProperties.KeywordDifficulty)
	assert.Equal(t, "informational", suggestions[0].SearchIntentInfo.MainIntent)
	assert.Equal(t, "best seo tools", suggestions[1].Keyword)
}

func TestGetDomainRankingKeywords_Success(t *testing.T) {
	sv := 800
	kd := 35

	rankedResult := []domainRankingKeywordsResult{{
		SEType:     "google",
		Target:     "example.com",
		TotalCount: 250,
		ItemsCount: 2,
		Items: []domainKeywordItem{
			{
				SEType: "google",
				KeywordData: &keywordDataNested{
					Keyword:      "example keyword",
					LocationCode: 2840,
					LanguageCode: "en",
					KeywordInfo: KeywordInfo{
						SearchVolume:     &sv,
						CompetitionLevel: "HIGH",
					},
					KeywordProperties: KeywordProperties{
						KeywordDifficulty: &kd,
						WordCount:         2,
					},
					SearchIntentInfo: &SearchIntentInfo{
						MainIntent: "commercial",
					},
				},
				RankedSERPElement: &RankedSERPElement{
					SEType: "google",
					SERPItem: SERPItem{
						Type:         "organic",
						RankGroup:    3,
						RankAbsolute: 5,
						Position:     "left",
						Title:        "Example Page",
						URL:          "https://example.com/page",
						ETV:          120.5,
					},
				},
			},
			{
				SEType: "google",
				KeywordData: &keywordDataNested{
					Keyword: "another keyword",
					KeywordInfo: KeywordInfo{
						SearchVolume: &sv,
					},
				},
				RankedSERPElement: &RankedSERPElement{
					SEType: "google",
					SERPItem: SERPItem{
						RankGroup: 7,
					},
				},
			},
		},
	}}

	result, _ := json.Marshal(rankedResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/dataforseo_labs/google/ranked_keywords/live")

		body, _ := io.ReadAll(r.Body)
		var reqs []domainRankingKeywordsRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "example.com", reqs[0].Target)
		assert.Equal(t, 2840, reqs[0].LocationCode)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	keywords, total, err := client.GetDomainRankingKeywords(ctx, "example.com", 2840, "en", 10, 0)
	require.NoError(t, err)
	assert.Equal(t, 250, total)
	require.Len(t, keywords, 2)

	// First keyword: verify flattening from nested structure
	assert.Equal(t, "example keyword", keywords[0].Keyword)
	assert.Equal(t, 800, *keywords[0].KeywordInfo.SearchVolume)
	assert.Equal(t, 35, *keywords[0].KeywordProperties.KeywordDifficulty)
	assert.Equal(t, "commercial", keywords[0].SearchIntentInfo.MainIntent)
	require.NotNil(t, keywords[0].RankedSERPElement)
	assert.Equal(t, 3, keywords[0].RankedSERPElement.SERPItem.RankGroup)
	assert.Equal(t, "https://example.com/page", keywords[0].RankedSERPElement.SERPItem.URL)
	assert.Equal(t, 120.5, keywords[0].RankedSERPElement.SERPItem.ETV)

	// Second keyword
	assert.Equal(t, "another keyword", keywords[1].Keyword)
}

func TestGetCompetitorDomains_Success(t *testing.T) {
	competitorResult := []competitorDomainsResult{{
		SEType:     "google",
		TotalCount: 50,
		ItemsCount: 2,
		Items: []CompetitorDomain{
			{
				SEType:        "google",
				Domain:        "competitor1.com",
				AvgPosition:   12.5,
				SumPosition:   1250,
				Intersections: 100,
				FullDomainMetrics: map[string]*PositionMetrics{
					"organic": {
						Pos1:  5,
						Pos2_3: 10,
						ETV:   5000.0,
						Count: 500,
					},
				},
			},
			{
				SEType:        "google",
				Domain:        "competitor2.com",
				AvgPosition:   18.3,
				SumPosition:   1830,
				Intersections: 75,
			},
		},
	}}

	result, _ := json.Marshal(competitorResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/dataforseo_labs/google/competitors_domain/live")

		body, _ := io.ReadAll(r.Body)
		var reqs []competitorDomainsRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "example.com", reqs[0].Target)
		assert.Equal(t, 2840, reqs[0].LocationCode)
		assert.Equal(t, "en", reqs[0].LanguageCode)
		assert.Equal(t, 20, reqs[0].Limit)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	competitors, err := client.GetCompetitorDomains(ctx, "example.com", 2840, "en", 20)
	require.NoError(t, err)
	require.Len(t, competitors, 2)
	assert.Equal(t, "competitor1.com", competitors[0].Domain)
	assert.Equal(t, 12.5, competitors[0].AvgPosition)
	assert.Equal(t, 100, competitors[0].Intersections)
	require.NotNil(t, competitors[0].FullDomainMetrics["organic"])
	assert.Equal(t, 5, competitors[0].FullDomainMetrics["organic"].Pos1)
	assert.Equal(t, 5000.0, competitors[0].FullDomainMetrics["organic"].ETV)
	assert.Equal(t, "competitor2.com", competitors[1].Domain)
}

func TestGetKeywordGaps_Success(t *testing.T) {
	sv := 600
	kd := 55

	gapsResult := []domainIntersectionResult{{
		SEType:     "google",
		TotalCount: 30,
		ItemsCount: 2,
		Items: []KeywordGap{
			{
				SEType: "google",
				KeywordData: &KeywordGapData{
					Keyword:      "shared keyword",
					LocationCode: 2840,
					LanguageCode: "en",
					KeywordInfo: KeywordInfo{
						SearchVolume:     &sv,
						CompetitionLevel: "MEDIUM",
					},
					KeywordProperties: KeywordProperties{
						KeywordDifficulty: &kd,
						WordCount:         2,
					},
				},
				FirstDomainSERPElement: &SERPItem{
					RankGroup:    5,
					RankAbsolute: 7,
					URL:          "https://example.com/page1",
				},
				SecondDomainSERPElement: &SERPItem{
					RankGroup:    12,
					RankAbsolute: 15,
					URL:          "https://competitor.com/page1",
				},
			},
			{
				SEType: "google",
				KeywordData: &KeywordGapData{
					Keyword: "another shared keyword",
				},
				FirstDomainSERPElement: &SERPItem{
					RankGroup: 2,
				},
				SecondDomainSERPElement: &SERPItem{
					RankGroup: 20,
				},
			},
		},
	}}

	result, _ := json.Marshal(gapsResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/dataforseo_labs/google/domain_intersection/live")

		body, _ := io.ReadAll(r.Body)
		var reqs []domainIntersectionRequest
		require.NoError(t, json.Unmarshal(body, &reqs))
		require.Len(t, reqs, 1)
		assert.Equal(t, "example.com", reqs[0].Target1)
		assert.Equal(t, "competitor.com", reqs[0].Target2)
		assert.Equal(t, 2840, reqs[0].LocationCode)

		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	gaps, err := client.GetKeywordGaps(ctx, "example.com", "competitor.com", 2840, "en", 10)
	require.NoError(t, err)
	require.Len(t, gaps, 2)

	assert.Equal(t, "shared keyword", gaps[0].KeywordData.Keyword)
	assert.Equal(t, 600, *gaps[0].KeywordData.KeywordInfo.SearchVolume)
	assert.Equal(t, 55, *gaps[0].KeywordData.KeywordProperties.KeywordDifficulty)
	assert.Equal(t, 5, gaps[0].FirstDomainSERPElement.RankGroup)
	assert.Equal(t, 12, gaps[0].SecondDomainSERPElement.RankGroup)

	assert.Equal(t, "another shared keyword", gaps[1].KeywordData.Keyword)
	assert.Equal(t, 2, gaps[1].FirstDomainSERPElement.RankGroup)
	assert.Equal(t, 20, gaps[1].SecondDomainSERPElement.RankGroup)
}

// ---------------------------------------------------------------------------
// Error and edge-case tests
// ---------------------------------------------------------------------------

func TestEmptyTasks_Error(t *testing.T) {
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(wrapEmptyTasksResponse())
	})

	ctx := context.Background()

	// CreateOnPageTask checks for empty tasks itself
	_, err := client.CreateOnPageTask(ctx, OnPageTaskPostRequest{Target: "example.com"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no tasks in response")
}

func TestEmptyTasks_FirstResult_Error(t *testing.T) {
	// Test that firstResult also returns error on empty tasks
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(wrapEmptyTasksResponse())
	})

	ctx := context.Background()

	// GetBacklinksSummary uses firstResult internally
	_, err := client.GetBacklinksSummary(ctx, "example.com")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no tasks in response")
}

func TestTaskError_Status(t *testing.T) {
	// Task has a non-20000 status code
	resp := Response{
		Version:       "0.1",
		StatusCode:    20000,
		StatusMessage: "Ok.",
		TasksCount:    1,
		Tasks: []Task{{
			ID:            "task-err",
			StatusCode:    40501,
			StatusMessage: "Insufficient credits",
		}},
	}
	b, _ := json.Marshal(resp)

	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(b)
	})

	ctx := context.Background()

	// CreateOnPageTask checks task.StatusCode
	_, err := client.CreateOnPageTask(ctx, OnPageTaskPostRequest{Target: "example.com"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "task error 40501")
	assert.Contains(t, err.Error(), "Insufficient credits")
}

func TestContextCancellation(t *testing.T) {
	// Server that blocks until context is cancelled
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	_, err := client.GetBacklinksSummary(ctx, "example.com")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "context canceled")
}

func TestPost_RetryOn5xx(t *testing.T) {
	attempts := 0
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("internal server error"))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write(wrapResponse(json.RawMessage(`[]`)))
	})

	// Override timeout so retries don't take too long
	client.httpClient.Timeout = 10 * time.Second

	ctx := context.Background()
	resp, err := client.post(ctx, "/test", nil)
	require.NoError(t, err)
	assert.Equal(t, 20000, resp.StatusCode)
	assert.Equal(t, 3, attempts, "should have retried twice before succeeding")
}

func TestPost_RetryExhausted(t *testing.T) {
	attempts := 0
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal server error"))
	})

	ctx := context.Background()
	_, err := client.post(ctx, "/test", nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "HTTP 500")
	assert.Equal(t, 3, attempts, "should have attempted 3 times total")
}

func TestFirstResult_EmptyResult(t *testing.T) {
	// Task has nil Result field
	c := NewClient("u", "p")
	resp := &Response{
		StatusCode: 20000,
		Tasks: []Task{{
			StatusCode: 20000,
			Result:     nil,
		}},
	}
	var dst []BacklinksSummary
	err := c.firstResult(resp, &dst)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "empty result")
}

func TestGetOnPagePages_EmptyResults(t *testing.T) {
	// Empty results array should return nil pages and 0 count
	emptyResult, _ := json.Marshal([]onPagePagesResult{})
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(wrapResponse(emptyResult))
	})

	ctx := context.Background()
	pages, total, err := client.GetOnPagePages(ctx, "task-id", 10, 0)
	require.NoError(t, err)
	assert.Nil(t, pages)
	assert.Equal(t, 0, total)
}

func TestGetReferringDomains_EmptyResults(t *testing.T) {
	emptyResult, _ := json.Marshal([]backlinksReferringDomainsResult{})
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(wrapResponse(emptyResult))
	})

	ctx := context.Background()
	domains, err := client.GetReferringDomains(ctx, "example.com", 10, 0)
	require.NoError(t, err)
	assert.Nil(t, domains)
}

func TestGetDomainRankingKeywords_EmptyResults(t *testing.T) {
	emptyResult, _ := json.Marshal([]domainRankingKeywordsResult{})
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(wrapResponse(emptyResult))
	})

	ctx := context.Background()
	keywords, total, err := client.GetDomainRankingKeywords(ctx, "example.com", 2840, "en", 10, 0)
	require.NoError(t, err)
	assert.Nil(t, keywords)
	assert.Equal(t, 0, total)
}

func TestGetDomainRankingKeywords_NilKeywordData(t *testing.T) {
	// Verify that nil KeywordData doesn't cause a panic
	rankedResult := []domainRankingKeywordsResult{{
		SEType:     "google",
		Target:     "example.com",
		TotalCount: 1,
		ItemsCount: 1,
		Items: []domainKeywordItem{{
			SEType:      "google",
			KeywordData: nil, // nil keyword data
			RankedSERPElement: &RankedSERPElement{
				SEType: "google",
				SERPItem: SERPItem{
					RankGroup: 5,
				},
			},
		}},
	}}

	result, _ := json.Marshal(rankedResult)
	_, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write(wrapResponse(result))
	})

	ctx := context.Background()
	keywords, total, err := client.GetDomainRankingKeywords(ctx, "example.com", 2840, "en", 10, 0)
	require.NoError(t, err)
	assert.Equal(t, 1, total)
	require.Len(t, keywords, 1)
	assert.Equal(t, "", keywords[0].Keyword) // empty when KeywordData is nil
	assert.Equal(t, 5, keywords[0].RankedSERPElement.SERPItem.RankGroup)
}
