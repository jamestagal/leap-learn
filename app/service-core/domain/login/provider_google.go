package login

import (
	"encoding/json"
	"errors"
	"fmt"
	"service-core/config"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type googleProvider struct {
	cfg *config.Config
}

func (p *googleProvider) GetProvider() Provider {
	return Google
}

func (p *googleProvider) GetOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     p.cfg.GoogleClientID,
		ClientSecret: p.cfg.GoogleClientSecret,
		Endpoint:     google.Endpoint,
		RedirectURL:  p.cfg.CoreURL + "/login-callback/google",
		Scopes:       []string{"profile", "email", "openid"},
	}
}

func (p *googleProvider) GetUserInfo(ctx context.Context, accessToken string) (*Info, error) {
	url := "https://www.googleapis.com/oauth2/v2/userinfo"
	userInfoB, err := httpCall(ctx, url, accessToken)
	if err != nil {
		return nil, fmt.Errorf("httpCall: %w", err)
	}
	var userInfo map[string]any
	err = json.Unmarshal(userInfoB, &userInfo)
	if err != nil {
		return nil, fmt.Errorf("json.Unmarshal: %w", err)
	}
	sub, ok := userInfo["id"].(string)
	if !ok {
		return nil, errors.New("invalid user id")
	}
	email, ok := userInfo["email"].(string)
	if !ok {
		email = ""
	}
	avatar, ok := userInfo["picture"].(string)
	if !ok {
		avatar = ""
	}
	return &Info{
		Email:  email,
		Sub:    sub,
		Avatar: avatar,
	}, nil
}
