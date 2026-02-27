package auth

import (
	"errors"
	"fmt"
	"os"
	"service-admin/config"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func getPublicKey() ([]byte, error) {
	if key := os.Getenv("JWT_PUBLIC_KEY"); key != "" {
		return []byte(key), nil
	}
	return os.ReadFile("/public.pem")
}

type Service struct {
	cfg *config.Config
}

func NewService(cfg *config.Config) *Service {
	return &Service{cfg: cfg}
}

// WARNING: UPDATE IN ALL SERVICES
const (
	GetNotes   int64 = 0x0000000000000001
	CreateNote int64 = 0x0000000000000002
	EditNote   int64 = 0x0000000000000004
	RemoveNote int64 = 0x0000000000000008

	GetEmails int64 = 0x0000000000000040
	SendEmail int64 = 0x0000000000000080

	GetFiles     int64 = 0x0000000000000100
	UploadFile   int64 = 0x0000000000000200
	DownloadFile int64 = 0x0000000000000400
	RemoveFile   int64 = 0x0000000000000800

	// Admin access
	GetUsers int64 = 0x0000000000001000
	EditUser int64 = 0x0000000000002000
)

type SessionTokenClaims struct {
	ID    uuid.UUID `json:"id"`
	Phone string    `json:"phone"`
}

func (s *Service) ValidateSessionToken(tokenString string) (*SessionTokenClaims, error) {
	claims, err := extractTokenClaims(tokenString)
	if err != nil {
		return nil, fmt.Errorf("error extracting claims: %w", err)
	}
	sessionTokenClaims, err := extractSessionTokenClaims(claims)
	if err != nil {
		return nil, fmt.Errorf("error extracting claims: %w", err)
	}
	return sessionTokenClaims, nil
}

func extractSessionTokenClaims(claims jwt.MapClaims) (*SessionTokenClaims, error) {
	id, ok := claims["id"].(string)
	if !ok {
		return nil, fmt.Errorf("claims missing 'id' field: %w", errors.New("invalid claims"))
	}
	UUID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("error parsing user ID: %w", err)
	}
	phone, ok := claims["phone"].(string)
	if !ok {
		return nil, fmt.Errorf("claims missing 'phone' field: %w", errors.New("invalid claims"))
	}

	sessionTokenClaims := SessionTokenClaims{
		ID:    UUID,
		Phone: phone,
	}
	return &sessionTokenClaims, nil
}

type AccessTokenClaims struct {
	ID                 uuid.UUID `json:"id"`
	Access             int64     `json:"access"`
	Avatar             string    `json:"avatar"`
	Email              string    `json:"email"`
	SubscriptionActive bool      `json:"subscription_active"`
}

func (s *Service) ValidateAccessToken(tokenString string) (*AccessTokenClaims, error) {
	claims, err := extractTokenClaims(tokenString)
	if err != nil {
		return nil, fmt.Errorf("error extracting claims: %w", err)
	}
	accessTokenClaims, err := extractAccessTokenClaims(claims)
	if err != nil {
		return nil, fmt.Errorf("error extracting claims: %w", err)
	}
	return accessTokenClaims, nil
}

func extractTokenClaims(tokenString string) (jwt.MapClaims, error) {
	// Check if token starts with "Bearer "
	if strings.HasPrefix(strings.ToLower(tokenString), "bearer ") {
		tokenString = tokenString[7:]
	}
	// Load the public key
	publicKey, err := getPublicKey()
	if err != nil {
		return nil, fmt.Errorf("error reading public key: %w", err)
	}
	if len(publicKey) == 0 {
		return nil, fmt.Errorf("error reading public key: %w", err)
	}
	// Parse the public key
	publicKeyParsed, err := jwt.ParseEdPublicKeyFromPEM(publicKey)
	if err != nil {
		return nil, fmt.Errorf("error parsing public key: %w", err)
	}
	// Parse the token
	token, err := jwt.Parse(tokenString, func(_ *jwt.Token) (any, error) {
		return publicKeyParsed, nil
	})
	if err != nil {
		return nil, fmt.Errorf("error parsing token: %w", err)
	}
	// Validate the refresh token
	if !token.Valid {
		return nil, errors.New("token is invalid")
	}
	// Get the claims
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("error getting claims")
	}
	return claims, nil
}

var ErrInvalidClaims = errors.New("claims are invalid")

func extractAccessTokenClaims(claims jwt.MapClaims) (*AccessTokenClaims, error) {
	id, ok := claims["id"].(string)
	if !ok {
		return nil, fmt.Errorf("claims missing 'id' field: %w", ErrInvalidClaims)
	}
	access, ok := claims["access"].(float64)
	if !ok {
		return nil, fmt.Errorf("claims missing 'access' field: %w", ErrInvalidClaims)
	}
	avatar, ok := claims["avatar"].(string)
	if !ok {
		return nil, fmt.Errorf("claims missing 'avatar' field: %w", ErrInvalidClaims)
	}
	email, ok := claims["email"].(string)
	if !ok {
		return nil, fmt.Errorf("claims missing 'email' field: %w", ErrInvalidClaims)
	}
	subscriptionActive, ok := claims["subscription_active"].(bool)
	if !ok {
		return nil, fmt.Errorf("claims missing 'subscription_active' field: %w", ErrInvalidClaims)
	}
    uuid, err := uuid.Parse(id)
    if err != nil {
        return nil, fmt.Errorf("error parsing UUID: %w", err)
    }
	accessTokenClaims := AccessTokenClaims{
		ID:                 uuid,
		Access:             int64(access),
		Avatar:             avatar,
		Email:              email,
		SubscriptionActive: subscriptionActive,
	}
	return &accessTokenClaims, nil
}
