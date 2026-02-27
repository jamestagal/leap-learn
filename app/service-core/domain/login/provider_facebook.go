package login

import (
	"encoding/json"
	"errors"
	"fmt"
	"service-core/config"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
)

type facebookProvider struct {
	cfg *config.Config
}

func (p *facebookProvider) GetProvider() Provider {
	return Facebook
}

func (p *facebookProvider) GetOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     p.cfg.FacebookClientID,
		ClientSecret: p.cfg.FacebookClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:  "https://www.facebook.com/v10.0/dialog/oauth",
			TokenURL: "https://graph.facebook.com/v10.0/oauth/access_token",
		},
		RedirectURL: p.cfg.CoreURL + "/login-callback/facebook",
		Scopes:      []string{"email"},
	}
}

func (p *facebookProvider) GetUserInfo(ctx context.Context, accessToken string) (*Info, error) {
	url := "https://graph.facebook.com/me?fields=id,name,email,picture&access_token=" + accessToken
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
	picture, ok := userInfo["picture"].(map[string]any)["data"].(map[string]any)["url"].(string)
	if !ok {
		picture = ""
	}
	return &Info{
		Email:  email,
		Sub:    sub,
		Avatar: picture,
	}, nil
}
