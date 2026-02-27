package login

import (
	"encoding/json"
	"errors"
	"fmt"
	"service-core/config"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/microsoft"
)

type microsoftProvider struct {
	cfg *config.Config
}

func (p *microsoftProvider) GetOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     p.cfg.MicrosoftClientID,
		ClientSecret: p.cfg.MicrosoftClientSecret,
		Endpoint:     microsoft.AzureADEndpoint("common"),
		RedirectURL:  p.cfg.CoreURL + "/login-callback/microsoft",
		Scopes:       []string{"profile", "email", "openid", "User.Read"},
	}
}

func (p *microsoftProvider) GetUserInfo(ctx context.Context, accessToken string) (*Info, error) {
	url := "https://graph.microsoft.com/v1.0/me"
	userInfoB, err := httpCall(ctx, url, accessToken)
	if err != nil {
		return nil, fmt.Errorf("httpCall to Microsoft Graph API: %w", err)
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
	email, _ := userInfo["mail"].(string)
	if email == "" {
		email, _ = userInfo["userPrincipalName"].(string)
	}
	avatar, _ := userInfo["profilePhotoUrl"].(string)
	return &Info{
		Email:  email,
		Sub:    sub,
		Avatar: avatar,
	}, nil
}
