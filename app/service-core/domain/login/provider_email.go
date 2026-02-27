package login

import (
	"service-core/config"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
)

type emailProvider struct {
	cfg *config.Config
}

func (p *emailProvider) GetProvider() Provider {
	return Email
}

func (p *emailProvider) GetOAuthConfig() *oauth2.Config {
	return nil
}

func (p *emailProvider) GetUserInfo(_ context.Context, _ string) (*Info, error) {
	return &Info{
		Email:  "",
		Sub:    "",
		Avatar: "",
	}, nil
}
