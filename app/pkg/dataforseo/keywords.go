package dataforseo

import (
	"context"
	"fmt"
)

// KeywordSearchVolumeRequest contains parameters for a keyword search volume query.
type KeywordSearchVolumeRequest struct {
	Keywords       []string `json:"keywords"`
	LocationCode   int      `json:"location_code"`
	LanguageCode   string   `json:"language_code"`
	SearchPartners bool     `json:"search_partners,omitempty"`
	DateFrom       string   `json:"date_from,omitempty"`
	DateTo         string   `json:"date_to,omitempty"`
}

// KeywordData contains search volume and competition data for a keyword.
type KeywordData struct {
	Keyword            string           `json:"keyword"`
	Spell              string           `json:"spell"`
	LocationCode       int              `json:"location_code"`
	LanguageCode       string           `json:"language_code"`
	SearchPartners     bool             `json:"search_partners"`
	Competition        string           `json:"competition"`
	CompetitionIndex   *int             `json:"competition_index"`
	SearchVolume       *int             `json:"search_volume"`
	LowTopOfPageBid    *float64         `json:"low_top_of_page_bid"`
	HighTopOfPageBid   *float64         `json:"high_top_of_page_bid"`
	CPC                *float64         `json:"cpc"`
	MonthlySearches    []MonthlySearch  `json:"monthly_searches"`
}

// MonthlySearch contains search volume data for a single month.
type MonthlySearch struct {
	Year         int `json:"year"`
	Month        int `json:"month"`
	SearchVolume int `json:"search_volume"`
}

// keywordSearchVolumeResult wraps the search volume response.
type keywordSearchVolumeResult struct {
	ItemsCount int           `json:"items_count"`
	Items      []KeywordData `json:"items"`
}

// GetSearchVolume retrieves search volume data for a list of keywords.
func (c *Client) GetSearchVolume(ctx context.Context, req KeywordSearchVolumeRequest) ([]KeywordData, error) {
	payload := []KeywordSearchVolumeRequest{req}
	resp, err := c.post(ctx, "/keywords_data/google_ads/search_volume/live", payload)
	if err != nil {
		return nil, err
	}
	var results []keywordSearchVolumeResult
	if err := c.firstResult(resp, &results); err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("dataforseo: empty search volume result")
	}
	return results[0].Items, nil
}
