package login

import (
	"fmt"
	"io"
	"net/http"
	"service-core/config"

	"golang.org/x/net/context"
)

type Provider string

const (
	Google    Provider = "google"
	Github    Provider = "github"
	Microsoft Provider = "microsoft"
	Facebook  Provider = "facebook"
	Email     Provider = "email"
)

type Info struct {
	Email  string
	Sub    string
	Avatar string
}

type GithubEmailInfo struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

//nolint:ireturn
func newProvider(cfg *config.Config, provider Provider) provider {
	switch provider {
	case Google:
		return &googleProvider{cfg: cfg}
	case Github:
		return &githubProvider{cfg: cfg}
	case Microsoft:
		return &microsoftProvider{cfg: cfg}
	case Facebook:
		return &facebookProvider{cfg: cfg}
	case Email:
		return &emailProvider{cfg: cfg}
	default:
		panic("Invalid provider")
	}
}

// Helper
func httpCall(ctx context.Context, url, accessToken string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("http.NewRequest: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	if url == "https://api.github.com/user/emails" {
		req.Header.Set("Accept", "application/vnd.github+json")
	}
	client := http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("client.Do: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http response status: %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("io.ReadAll: %w", err)
	}
	return body, nil
}
