package login

import (
	"golang.org/x/net/context"
	"golang.org/x/oauth2"
)

type MockProvider struct{}

func NewMockProvider() *MockProvider {
	return &MockProvider{}
}

func (p *MockProvider) GetProvider() Provider {
	return Google
}

func (p *MockProvider) GetOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     "",
		ClientSecret: "",
		Endpoint: oauth2.Endpoint{
			AuthURL:       "",
			DeviceAuthURL: "",
			TokenURL:      "",
			AuthStyle:     0,
		},
		RedirectURL: "",
		Scopes:      []string{},
	}
}

func (p *MockProvider) GetUserInfo(_ context.Context, _ string) (*Info, error) {
	return &Info{
		Email:  "",
		Sub:    "",
		Avatar: "",
	}, nil
}
