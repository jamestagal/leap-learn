package dataforseo

import (
	"context"
	"fmt"
)

// KeywordInfo contains core keyword metrics from DataForSEO Labs.
type KeywordInfo struct {
	SearchVolume     *int     `json:"search_volume"`
	Competition      *float64 `json:"competition"`
	CompetitionLevel string   `json:"competition_level"`
	CPC              *float64 `json:"cpc"`
	LowTopOfPageBid  *float64 `json:"low_top_of_page_bid"`
	HighTopOfPageBid *float64 `json:"high_top_of_page_bid"`
	MonthlySearches  []MonthlySearch `json:"monthly_searches"`
}

// KeywordProperties contains supplementary keyword metadata.
type KeywordProperties struct {
	CoreKeyword       string  `json:"core_keyword"`
	KeywordDifficulty *int    `json:"keyword_difficulty"`
	DetectedLanguage  string  `json:"detected_language"`
	WordCount         int     `json:"keyword_word_count"`
}

// SearchIntentInfo describes the search intent classification.
type SearchIntentInfo struct {
	MainIntent          string   `json:"main_intent"`
	ForeignIntent       []string `json:"foreign_intent"`
}

// SERPInfo contains SERP-level data for a keyword.
type SERPInfo struct {
	SEType           string   `json:"se_type"`
	CheckURL         string   `json:"check_url"`
	SERPItemTypes    []string `json:"serp_item_types"`
	ResultCount      int64    `json:"se_results_count"`
	LastUpdatedTime  string   `json:"last_updated_time"`
}

// AvgBacklinksInfo contains average backlink metrics for top-ranking pages.
type AvgBacklinksInfo struct {
	SearchVolume        *int     `json:"se_type"`
	Backlinks           float64  `json:"backlinks"`
	DoFollow            float64  `json:"dofollow"`
	ReferringPages      float64  `json:"referring_pages"`
	ReferringDomains    float64  `json:"referring_domains"`
	ReferringMainDomains float64 `json:"referring_main_domains"`
	Rank                float64  `json:"rank"`
	MainDomainRank      float64  `json:"main_domain_rank"`
	LastUpdatedTime     string   `json:"last_updated_time"`
}

// KeywordSuggestion represents a keyword suggestion from DataForSEO Labs.
type KeywordSuggestion struct {
	SEType            string            `json:"se_type"`
	Keyword           string            `json:"keyword"`
	LocationCode      int               `json:"location_code"`
	LanguageCode      string            `json:"language_code"`
	KeywordInfo       KeywordInfo       `json:"keyword_info"`
	KeywordProperties KeywordProperties `json:"keyword_properties"`
	SearchIntentInfo  *SearchIntentInfo `json:"search_intent_info"`
	SERPInfo          *SERPInfo         `json:"serp_info"`
	AvgBacklinksInfo  *AvgBacklinksInfo `json:"avg_backlinks_info"`
}

// keywordSuggestionsRequest is the request body for keyword suggestions.
type keywordSuggestionsRequest struct {
	Keyword      string `json:"keyword"`
	LocationCode int    `json:"location_code"`
	LanguageCode string `json:"language_code"`
	Limit        int    `json:"limit,omitempty"`
}

// keywordSuggestionsResult wraps the paginated keyword suggestions response.
type keywordSuggestionsResult struct {
	SEType       string              `json:"se_type"`
	Seed         string              `json:"seed_keyword"`
	TotalCount   int                 `json:"total_count"`
	ItemsCount   int                 `json:"items_count"`
	Items        []KeywordSuggestion `json:"items"`
}

// GetKeywordSuggestions retrieves keyword suggestions based on a seed keyword.
func (c *Client) GetKeywordSuggestions(ctx context.Context, keyword string, locationCode int, languageCode string, limit int) ([]KeywordSuggestion, error) {
	payload := []keywordSuggestionsRequest{{
		Keyword:      keyword,
		LocationCode: locationCode,
		LanguageCode: languageCode,
		Limit:        limit,
	}}
	resp, err := c.post(ctx, "/dataforseo_labs/google/keyword_suggestions/live", payload)
	if err != nil {
		return nil, err
	}
	var results []keywordSuggestionsResult
	if err := c.firstResult(resp, &results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("dataforseo: empty keyword suggestions result")
	}
	return results[0].Items, nil
}

// DomainKeyword represents a keyword that a domain ranks for.
// This is a flattened view assembled from the nested API response.
type DomainKeyword struct {
	SEType            string             `json:"se_type"`
	Keyword           string             `json:"keyword"`
	KeywordInfo       KeywordInfo        `json:"keyword_info"`
	KeywordProperties KeywordProperties  `json:"keyword_properties"`
	SearchIntentInfo  *SearchIntentInfo  `json:"search_intent_info"`
	RankedSERPElement *RankedSERPElement `json:"ranked_serp_element"`
}

// RankedSERPElement contains SERP position data for a domain keyword.
type RankedSERPElement struct {
	SEType           string  `json:"se_type"`
	SERPItem         SERPItem `json:"serp_item"`
}

// SERPItem contains the SERP position details.
type SERPItem struct {
	Type            string  `json:"type"`
	RankGroup       int     `json:"rank_group"`
	RankAbsolute    int     `json:"rank_absolute"`
	Position        string  `json:"position"`
	Title           string  `json:"title"`
	Description     string  `json:"description"`
	URL             string  `json:"url"`
	Breadcrumb      string  `json:"breadcrumb"`
	ETV             float64 `json:"etv"`
	EstimatedPaidTrafficCost float64 `json:"estimated_paid_traffic_cost"`
	IsUp            bool    `json:"is_up"`
	IsDown          bool    `json:"is_down"`
	IsNew           bool    `json:"is_new"`
	IsLost          bool    `json:"is_lost"`
}

// domainRankingKeywordsRequest is the request body for ranked keywords.
type domainRankingKeywordsRequest struct {
	Target       string `json:"target"`
	LocationCode int    `json:"location_code"`
	LanguageCode string `json:"language_code"`
	Limit        int    `json:"limit,omitempty"`
	Offset       int    `json:"offset,omitempty"`
}

// domainRankingKeywordsResult wraps the ranked keywords response.
type domainRankingKeywordsResult struct {
	SEType     string `json:"se_type"`
	Target     string `json:"target"`
	TotalCount int    `json:"total_count"`
	ItemsCount int    `json:"items_count"`
	Items      []domainKeywordItem `json:"items"`
}

// domainKeywordItem is the raw item from the ranked_keywords endpoint.
type domainKeywordItem struct {
	SEType            string             `json:"se_type"`
	KeywordData       *keywordDataNested `json:"keyword_data"`
	RankedSERPElement *RankedSERPElement `json:"ranked_serp_element"`
}

// keywordDataNested contains keyword info nested inside ranked keyword items.
type keywordDataNested struct {
	Keyword           string            `json:"keyword"`
	LocationCode      int               `json:"location_code"`
	LanguageCode      string            `json:"language_code"`
	KeywordInfo       KeywordInfo       `json:"keyword_info"`
	KeywordProperties KeywordProperties `json:"keyword_properties"`
	SearchIntentInfo  *SearchIntentInfo `json:"search_intent_info"`
	SERPInfo          *SERPInfo         `json:"serp_info"`
}

// GetDomainRankingKeywords retrieves keywords a domain ranks for.
// Returns the keywords, total count, and any error.
func (c *Client) GetDomainRankingKeywords(ctx context.Context, target string, locationCode int, languageCode string, limit, offset int) ([]DomainKeyword, int, error) {
	payload := []domainRankingKeywordsRequest{{
		Target:       target,
		LocationCode: locationCode,
		LanguageCode: languageCode,
		Limit:        limit,
		Offset:       offset,
	}}
	resp, err := c.post(ctx, "/dataforseo_labs/google/ranked_keywords/live", payload)
	if err != nil {
		return nil, 0, err
	}
	var results []domainRankingKeywordsResult
	if err := c.firstResult(resp, &results); err != nil {
		return nil, 0, err
	}
	if len(results) == 0 {
		return nil, 0, nil
	}

	items := results[0].Items
	keywords := make([]DomainKeyword, 0, len(items))
	for _, item := range items {
		dk := DomainKeyword{
			SEType:            item.SEType,
			RankedSERPElement: item.RankedSERPElement,
		}
		if item.KeywordData != nil {
			dk.Keyword = item.KeywordData.Keyword
			dk.KeywordInfo = item.KeywordData.KeywordInfo
			dk.KeywordProperties = item.KeywordData.KeywordProperties
			dk.SearchIntentInfo = item.KeywordData.SearchIntentInfo
		}
		keywords = append(keywords, dk)
	}
	return keywords, results[0].TotalCount, nil
}

// CompetitorDomain represents a competitor domain found through DataForSEO Labs.
type CompetitorDomain struct {
	SEType         string            `json:"se_type"`
	Domain         string            `json:"domain"`
	AvgPosition    float64           `json:"avg_position"`
	SumPosition    int               `json:"sum_position"`
	Intersections  int               `json:"intersections"`
	FullDomainMetrics  map[string]*PositionMetrics `json:"full_domain_metrics"`
	MetricsComparison  map[string]*PositionMetrics `json:"metrics"`
}

// PositionMetrics contains position-bucketed ranking data.
type PositionMetrics struct {
	Pos1     int     `json:"pos_1"`
	Pos2_3   int     `json:"pos_2_3"`
	Pos4_10  int     `json:"pos_4_10"`
	Pos11_20 int     `json:"pos_11_20"`
	Pos21_30 int     `json:"pos_21_30"`
	Pos31_40 int     `json:"pos_31_40"`
	Pos41_50 int     `json:"pos_41_50"`
	Pos51_60 int     `json:"pos_51_60"`
	Pos61_70 int     `json:"pos_61_70"`
	Pos71_80 int     `json:"pos_71_80"`
	Pos81_90 int     `json:"pos_81_90"`
	Pos91_100 int    `json:"pos_91_100"`
	ETV      float64 `json:"etv"`
	Count    int     `json:"count"`
	EstimatedPaidTrafficCost float64 `json:"estimated_paid_traffic_cost"`
	IsNew    int     `json:"is_new"`
	IsUp     int     `json:"is_up"`
	IsDown   int     `json:"is_down"`
	IsLost   int     `json:"is_lost"`
}

// competitorDomainsRequest is the request body for competitors_domain.
type competitorDomainsRequest struct {
	Target       string `json:"target"`
	LocationCode int    `json:"location_code"`
	LanguageCode string `json:"language_code"`
	Limit        int    `json:"limit,omitempty"`
}

// competitorDomainsResult wraps the competitors domain response.
type competitorDomainsResult struct {
	SEType     string             `json:"se_type"`
	TotalCount int                `json:"total_count"`
	ItemsCount int                `json:"items_count"`
	Items      []CompetitorDomain `json:"items"`
}

// GetCompetitorDomains discovers competitor domains for a target.
func (c *Client) GetCompetitorDomains(ctx context.Context, target string, locationCode int, languageCode string, limit int) ([]CompetitorDomain, error) {
	payload := []competitorDomainsRequest{{
		Target:       target,
		LocationCode: locationCode,
		LanguageCode: languageCode,
		Limit:        limit,
	}}
	resp, err := c.post(ctx, "/dataforseo_labs/google/competitors_domain/live", payload)
	if err != nil {
		return nil, err
	}
	var results []competitorDomainsResult
	if err := c.firstResult(resp, &results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("dataforseo: empty competitor domains result")
	}
	return results[0].Items, nil
}

// KeywordGap represents a keyword from domain intersection analysis.
type KeywordGap struct {
	SEType                 string            `json:"se_type"`
	KeywordData            *KeywordGapData   `json:"keyword_data"`
	FirstDomainSERPElement *SERPItem         `json:"first_domain_serp_element"`
	SecondDomainSERPElement *SERPItem        `json:"second_domain_serp_element"`
}

// KeywordGapData contains keyword info for a gap analysis item.
type KeywordGapData struct {
	Keyword           string            `json:"keyword"`
	LocationCode      int               `json:"location_code"`
	LanguageCode      string            `json:"language_code"`
	KeywordInfo       KeywordInfo       `json:"keyword_info"`
	KeywordProperties KeywordProperties `json:"keyword_properties"`
	SearchIntentInfo  *SearchIntentInfo `json:"search_intent_info"`
}

// domainIntersectionRequest is the request body for domain_intersection.
type domainIntersectionRequest struct {
	Target1      string `json:"target1"`
	Target2      string `json:"target2"`
	LocationCode int    `json:"location_code"`
	LanguageCode string `json:"language_code"`
	Limit        int    `json:"limit,omitempty"`
}

// domainIntersectionResult wraps the domain intersection response.
type domainIntersectionResult struct {
	SEType     string       `json:"se_type"`
	TotalCount int          `json:"total_count"`
	ItemsCount int          `json:"items_count"`
	Items      []KeywordGap `json:"items"`
}

// GetKeywordGaps finds keywords where two domains both rank.
func (c *Client) GetKeywordGaps(ctx context.Context, target1, target2 string, locationCode int, languageCode string, limit int) ([]KeywordGap, error) {
	payload := []domainIntersectionRequest{{
		Target1:      target1,
		Target2:      target2,
		LocationCode: locationCode,
		LanguageCode: languageCode,
		Limit:        limit,
	}}
	resp, err := c.post(ctx, "/dataforseo_labs/google/domain_intersection/live", payload)
	if err != nil {
		return nil, err
	}
	var results []domainIntersectionResult
	if err := c.firstResult(resp, &results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("dataforseo: empty keyword gaps result")
	}
	return results[0].Items, nil
}
