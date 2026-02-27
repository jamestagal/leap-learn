package email

import "context"

type MockProvider struct {}

func NewMockProvider() *MockProvider {
    return &MockProvider{}
}

func (p *MockProvider) Send(_ context.Context, _ Email) error {
    return nil
}
