package auth

// AuthService defines the interface for authentication operations
type AuthService interface {
	Auth(token string, access int64) (*AccessTokenClaims, error)
	ValidateAccessToken(token string) (*AccessTokenClaims, error)
	HasAccess(access int64, userAccess int64) bool
	UpdateAccess(userAccess int64, access int64) (int64, error)
	HasAccessABAC(access int64, userAccess int64, userAttr UserAttr) bool
	GenerateSessionToken(userID, phone string) (string, error)
	ValidateSessionToken(token string) (*SessionTokenClaims, error)
	GenerateTokens(refreshTokenID, userID string, access int64, avatar, email string, subscriptionActive bool) (string, string, error)
	ValidateRefreshToken(token string) (*RefreshTokenClaims, error)
}

// Ensure Service implements AuthService interface
var _ AuthService = (*Service)(nil)