package login

import (
	"encoding/json"
	"errors"
	"fmt"
	"service-core/config"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
)

type githubProvider struct {
	cfg *config.Config
}

func (p *githubProvider) GetProvider() Provider {
	return Github
}

func (p *githubProvider) GetOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     p.cfg.GithubClientID,
		ClientSecret: p.cfg.GithubClientSecret,
		Endpoint:     github.Endpoint,
		RedirectURL:  p.cfg.CoreURL + "/login-callback/github",
		Scopes:       []string{"user:email"},
	}
}

func (p *githubProvider) GetUserInfo(ctx context.Context, accessToken string) (*Info, error) {
	url := "https://api.github.com/user"
	userInfoB, err := httpCall(ctx, url, accessToken)
	if err != nil {
		return nil, fmt.Errorf("httpCall: %w", err)
	}
	var userInfo map[string]any
	err = json.Unmarshal(userInfoB, &userInfo)
	if err != nil {
		return nil, fmt.Errorf("json.Unmarshal: %w", err)
	}
	userID, ok := userInfo["id"].(float64)
	if !ok {
		return nil, errors.New("invalid user id")
	}
	sub := fmt.Sprintf("%.0f", userID)
	email, ok := userInfo["email"].(string)
	if !ok {
		email = ""
	}
	avatar, ok := userInfo["avatar_url"].(string)
	if !ok {
		avatar = ""
	}
	if email == "" {
		emailsURL := "https://api.github.com/user/emails"
		emailsInfo, err := httpCall(ctx, emailsURL, accessToken)
		if err != nil {
			return nil, fmt.Errorf("httpCall: %w", err)
		}
		var emails []GithubEmailInfo
		err = json.Unmarshal(emailsInfo, &emails)
		if err != nil {
			return nil, fmt.Errorf("json.Unmarshal: %w", err)
		}
		for _, e := range emails {
			if e.Primary && e.Verified {
				email = e.Email
				break
			}
		}
		if email == "" {
			return nil, errors.New("no verified email found")
		}
	}
	return &Info{
		Email:  email,
		Sub:    sub,
		Avatar: avatar,
	}, nil
}
