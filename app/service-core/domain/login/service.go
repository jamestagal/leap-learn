package login

import (
	"app/pkg"
	"app/pkg/auth"
	"app/pkg/str"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"net/url"
	"service-core/config"
	"service-core/storage/query"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/twilio/twilio-go"
	verify "github.com/twilio/twilio-go/rest/verify/v2"
	"golang.org/x/oauth2"
)

type store interface {
	SelectToken(ctx context.Context, ID string) (query.Token, error)
	InsertToken(ctx context.Context, params query.InsertTokenParams) (query.Token, error)
	UpdateToken(ctx context.Context, params query.UpdateTokenParams) error
	SelectUser(ctx context.Context, ID uuid.UUID) (query.User, error)
	SelectUserByEmail(ctx context.Context, email string) (query.User, error)
	SelectUserByEmailAndSub(ctx context.Context, params query.SelectUserByEmailAndSubParams) (query.User, error)
	InsertUser(ctx context.Context, params query.InsertUserParams) (query.User, error)
	UpdateUserActivity(ctx context.Context, ID uuid.UUID) error
	UpdateUserAccess(ctx context.Context, params query.UpdateUserAccessParams) (query.User, error)
	UpdateUserPhone(ctx context.Context, params query.UpdateUserPhoneParams) error
	UpdateUserSub(ctx context.Context, params query.UpdateUserSubParams) error
	AcceptPendingMemberships(ctx context.Context, userID uuid.UUID) error
}

type provider interface {
	GetOAuthConfig() *oauth2.Config
	GetUserInfo(ctx context.Context, accessToken string) (*Info, error)
}

type authService interface {
	GenerateSessionToken(userID string, phone string) (string, error)
	ValidateSessionToken(token string) (*auth.SessionTokenClaims, error)

	GenerateTokens(refreshTokenID string, userID string, access int64, avatar string, email string, subscriptionActive bool) (string, string, error)
	ValidateAccessToken(token string) (*auth.AccessTokenClaims, error)
	ValidateRefreshToken(token string) (*auth.RefreshTokenClaims, error)
}

type emailService interface {
	SendEmail(
		ctx context.Context,
		userID uuid.UUID,
		emailTo string,
		emailSubject string,
		emailBody string,
		attachmentIDs []uuid.UUID,
	) (*query.Email, error)
}

type Service struct {
	cfg          *config.Config
	store        store
	authService  authService
	emailService emailService
}

func NewService(
	cfg *config.Config,
	store store,
	authService authService,
	emailService emailService,
) *Service {
	return &Service{
		cfg:          cfg,
		store:        store,
		authService:  authService,
		emailService: emailService,
	}
}

type AuthUser struct {
	ID                 string `json:"id"`
	Access             int64  `json:"access"`
	Avatar             string `json:"avatar"`
	Email              string `json:"email"`
	SubscriptionActive bool   `json:"subscription_active"`
}

type AuthResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ReturnURL    string    `json:"return_url"`
	User         *AuthUser `json:"user"`
	// used for 2FA
	SessionToken string `json:"session_token"`
	HasPhone     bool   `json:"has_phone"`
}

type URLResponse struct {
	URL string `json:"url"`
}

func (s *Service) Refresh(ctx context.Context, accessToken string, refreshToken string) (*AuthResponse, error) {
	// Validate token
	claims, err := s.authService.ValidateAccessToken(accessToken)

	if err == nil {
		// Get user from database
		user, err := s.store.SelectUser(ctx, claims.ID)
		if err != nil {
			return nil, pkg.NotFoundError{Message: "Error selecting user by ID", Err: err}
		}
		// Check if user has an active subscription
		subscriptionActive, access, err := s.checkUserAccess(ctx, user)
		if err != nil {
			return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error checking user access: %w", err)}
		}
		return &AuthResponse{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
			ReturnURL:    "",
			User: &AuthUser{
				ID:                 user.ID.String(),
				Access:             access,
				Avatar:             user.Avatar,
				Email:              user.Email,
				SubscriptionActive: subscriptionActive,
			},
			HasPhone:     false,
			SessionToken: "",
		}, nil
	}
	// Validate refresh token
	refreshTokenClaims, err := s.authService.ValidateRefreshToken(refreshToken)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error validating refresh token: %w", err)}
	}
	// Extract token from database
	refreshTokenStore, err := s.store.SelectToken(ctx, refreshTokenClaims.ID.String())
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting token by ID", Err: err}
	}
	// Check if token has a user Id, if not it means the token have been revoked
	if refreshTokenStore.Target == "" {
		return nil, pkg.UnauthorizedError{Err: errors.New("token have been revoked")}
	}
	// Check if token is expired
	if time.Now().After(refreshTokenStore.Expires) {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("token expired: %w", err)}
	}
	// Get user from database
	user, err := s.store.SelectUser(ctx, refreshTokenClaims.UserID)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting user by ID", Err: err}
	}
	// Create refresh token (valid for 30 days)
	id, err := uuid.NewV7()
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error generating UUID: %w", err)}
	}
	params := query.InsertTokenParams{
		ID:       id.String(),
		Expires:  time.Now().Add(s.cfg.RefreshTokenExp),
		Target:   refreshTokenClaims.UserID.String(),
		Callback: "",
	}
	refreshTokenStore, err = s.store.InsertToken(ctx, params)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error inserting refresh token: %w", err)}
	}
	// Check if user has an active subscription
	subscriptionActive, access, err := s.checkUserAccess(ctx, user)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error checking user access: %w", err)}
	}

	// Generate JWT tokens
	newAccessToken, newRefreshToken, err := s.authService.GenerateTokens(
		refreshTokenStore.ID,
		user.ID.String(),
		access,
		user.Avatar,
		user.Email,
		subscriptionActive,
	)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error generating JWT token: %w", err)}
	}

	// Update user activity and update old refresh token expiration to 1 minute
	// This is to prevent the refresh token from being used again
	//nolint: contextcheck
	go func() {
		newCtx, cancel := context.WithTimeout(context.Background(), s.cfg.ContextTimeout)
		defer cancel()
		params := query.UpdateTokenParams{
			ID:      refreshTokenClaims.ID.String(),
			Expires: time.Now().Add(time.Minute),
		}
		err = s.store.UpdateToken(newCtx, params)
		if err != nil {
			slog.Error("Error updating token", "error", err)
		}
		err = s.store.UpdateUserActivity(newCtx, user.ID)
		if err != nil {
			slog.Error("Error updating user", "error", err)
		}
	}()

	return &AuthResponse{
		AccessToken:  newAccessToken,
		RefreshToken: newRefreshToken,
		ReturnURL:    "",
		User: &AuthUser{
			ID:                 user.ID.String(),
			Access:             access,
			Avatar:             user.Avatar,
			Email:              user.Email,
			SubscriptionActive: subscriptionActive,
		},
		SessionToken: "",
		HasPhone:     false,
	}, nil
}

func (s *Service) Login(
	ctx context.Context,
	userEmail string,
	returnURL string,
	provider Provider,
) (*URLResponse, error) {
	// Validate return URL starts with allowed base URLs (allows paths like /organisations/create)
	if !strings.HasPrefix(returnURL, s.cfg.AdminURL) && !strings.HasPrefix(returnURL, s.cfg.ClientURL) {
		return nil, pkg.UnauthorizedError{Err: errors.New("invalid return URL")}
	}

	ctx, cancel := context.WithTimeout(ctx, s.cfg.ContextTimeout)
	defer cancel()

	// Generate random state and verifier
	state, err := str.GenerateRandomBase64String()
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error generating random string: %w", err)}
	}
	verifier := oauth2.GenerateVerifier()
	// Store state and verifier in database
	params := query.InsertTokenParams{
		ID:       state,
		Expires:  time.Now().Add(s.cfg.AccessTokenExp),
		Target:   verifier,
		Callback: returnURL,
	}
	_, err = s.store.InsertToken(ctx, params)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error inserting token: %w", err)}
	}
	// Send magic link to user
	if provider == Email {
		// Validate email
		v := pkg.ValidationErrors{}
		_, err := mail.ParseAddress(userEmail)
		if err != nil {
			validationError := pkg.ValidationError{
				Field:   "email",
				Tag:     "email",
				Message: "Invalid email address",
			}
			v = append(v, validationError)
			return nil, v
		}
		subject := "Sign in to Webkit"
		loginURL := s.cfg.CoreURL + `/login-callback/email?state=` + url.QueryEscape(state) + `&email=` + url.QueryEscape(userEmail)
		body := `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign in to Webkit</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <!-- Logo/Brand -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding-bottom: 24px; text-align: center;">
                            <span style="font-size: 28px; font-weight: 700; color: #6366f1;">Webkit</span>
                        </td>
                    </tr>
                </table>

                <!-- Main Content -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding-bottom: 16px;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">Sign in to your account</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 24px;">
                            <p style="margin: 0; font-size: 16px; line-height: 24px; color: #52525b; text-align: center;">
                                Click the button below to securely sign in to Webkit. This link will expire in 15 minutes.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 24px; text-align: center;">
                            <a href="` + loginURL + `" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Sign In</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding-bottom: 24px;">
                            <p style="margin: 0; font-size: 14px; line-height: 20px; color: #71717a; text-align: center;">
                                If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 18px; color: #a1a1aa; text-align: center; word-break: break-all;">
                                ` + loginURL + `
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Security Notice -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="border-top: 1px solid #e4e4e7; padding-top: 24px;">
                            <p style="margin: 0; font-size: 13px; line-height: 20px; color: #a1a1aa; text-align: center;">
                                If you didn't request this email, you can safely ignore it. Never share this link with anyone.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="padding-top: 24px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                    © 2025 Webkit. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>`
		_, err = s.emailService.SendEmail(ctx, uuid.Nil, userEmail, subject, body, nil)
		if err != nil {
			return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error sending email: %w", err)}
		}
		return &URLResponse{URL: s.cfg.ClientURL + "/login?send=true"}, nil
	}
	// Redirect user to consent page to ask for permission
	p := newProvider(s.cfg, provider)
	url := p.GetOAuthConfig().AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.S256ChallengeOption(verifier))
	return &URLResponse{URL: url}, nil
}

func (s *Service) LoginCallback(
	ctx context.Context,
	state string,
	code string,
	email string,
	provider Provider,
) (*AuthResponse, error) {
	// Get verifier from state
	token, err := s.store.SelectToken(ctx, state)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error selecting token by ID", Err: fmt.Errorf("error selecting token by ID: %w", err)}
	}
	if time.Now().After(token.Expires) {
		return nil, pkg.InternalError{Message: "Token expired", Err: fmt.Errorf("token expired: %w", err)}
	}

	// Get user from database
	var user query.User
	var userEmail string
	var userSub string
	var userAvatar string
	if provider == Email {
		userEmail = email
		userSub = "email:" + email
		userAvatar = ""
	} else {
		// Verify code and exchange for token
		p := newProvider(s.cfg, provider)
		config := p.GetOAuthConfig()
		oauthToken, err := config.Exchange(ctx, code, oauth2.VerifierOption(token.Target))
		if err != nil {
			return nil, pkg.InternalError{Message: "Error exchanging code for token", Err: fmt.Errorf("error exchanging code for token: %w", err)}
		}

		// Fetch user info from github
		userInfo, err := p.GetUserInfo(ctx, oauthToken.AccessToken)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error fetching user info", Err: fmt.Errorf("error fetching user info: %w", err)}
		}

		// Get user, create if not exists
		userEmail = userInfo.Email
		userSub = fmt.Sprintf("%s:%s", provider, userInfo.Sub)
		userAvatar = userInfo.Avatar
	}
	// First try to find user by email (allows same account across login methods)
	user, err = s.store.SelectUserByEmail(ctx, userEmail)
	if err != nil {
		// User not found by email, create new user
		id, err := uuid.NewV7()
		if err != nil {
			return nil, pkg.InternalError{Message: "Error generating UUID", Err: fmt.Errorf("error generating UUID: %w", err)}
		}

		// Generate API key for new user
		apiKey, err := str.GenerateRandomHexString()
		if err != nil {
			return nil, pkg.InternalError{Message: "Error generating API key", Err: fmt.Errorf("error generating API key: %w", err)}
		}

		params := query.InsertUserParams{
			ID:     id,
			Email:  userEmail,
			Access: auth.NewUserAccess,
			Sub:    userSub,
			Avatar: userAvatar,
			ApiKey: apiKey,
		}
		user, err = s.store.InsertUser(ctx, params)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error inserting user", Err: fmt.Errorf("error inserting user: %w", err)}
		}
	} else {
		// User found by email - check if this is an invited user logging in for the first time
		if strings.HasPrefix(user.Sub, "invited:") {
			// Update sub to real provider sub
			err = s.store.UpdateUserSub(ctx, query.UpdateUserSubParams{
				ID:  user.ID,
				Sub: userSub,
			})
			if err != nil {
				return nil, pkg.InternalError{Message: "Error updating user sub", Err: fmt.Errorf("error updating user sub: %w", err)}
			}

			// Accept all pending memberships for this user
			err = s.store.AcceptPendingMemberships(ctx, user.ID)
			if err != nil {
				return nil, pkg.InternalError{Message: "Error accepting memberships", Err: fmt.Errorf("error accepting memberships: %w", err)}
			}
		}

		// Update avatar if provided and user doesn't have one
		if userAvatar != "" && user.Avatar == "" {
			// We could update avatar here if needed in future
		}
	}

	// If Twilio is not configured, skip 2FA
	if s.cfg.TwilioServiceSID == "" {
		authResponse, err := s.createAuthTokens(ctx, user)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error creating auth tokens", Err: fmt.Errorf("error creating auth tokens: %w", err)}
		}
		authResponse.ReturnURL = token.Callback
		return authResponse, nil
	}

	// If user has a phone number, send a 2FA code
	if user.Phone != "" {
		sessionToken, err := s.LoginPhone(ctx, user.ID, user.Phone)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error sending SMS", Err: fmt.Errorf("error sending SMS: %w", err)}
		}
		return &AuthResponse{
			ReturnURL:    token.Callback,
			SessionToken: sessionToken,
			HasPhone:     true,
			AccessToken:  "",
			RefreshToken: "",
			User:         nil,
		}, nil
	}
	// Generate session token
	sessionToken, err := s.authService.GenerateSessionToken(user.ID.String(), "")
	if err != nil {
		return nil, pkg.InternalError{Message: "Error generating session token", Err: fmt.Errorf("error generating session token: %w", err)}
	}
	return &AuthResponse{
		ReturnURL:    token.Callback,
		SessionToken: sessionToken,
		HasPhone:     false,
		AccessToken:  "",
		RefreshToken: "",
		User:         nil,
	}, nil
}

func (s *Service) LoginPhone(
	_ context.Context,
	userID uuid.UUID,
	phone string,
) (string, error) {
	if phone == "" {
		return "", pkg.UnauthorizedError{Err: errors.New("phone number is empty")}
	}
	// Send SMS
	client := twilio.NewRestClient()
	params := &verify.CreateVerificationParams{}
	params.SetTo(phone)
	params.SetChannel("sms")
	_, err := client.VerifyV2.CreateVerification(s.cfg.TwilioServiceSID, params)
	if err != nil {
		return "", pkg.UnauthorizedError{Err: fmt.Errorf("error sending SMS: %w", err)}
	}
	// Generate session token
	sessionToken, err := s.authService.GenerateSessionToken(userID.String(), phone)
	if err != nil {
		return "", pkg.UnauthorizedError{Err: fmt.Errorf("error generating session token: %w", err)}
	}
	return sessionToken, nil
}

func (s *Service) LoginVerify(
	ctx context.Context,
	userID uuid.UUID,
	phone string,
	code string,
) (*AuthResponse, error) {
	user, err := s.store.SelectUser(ctx, userID)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting user by ID", Err: fmt.Errorf("error selecting user by ID: %w", err)}
	}

	client := twilio.NewRestClient()
	params := &verify.CreateVerificationCheckParams{}
	params.SetTo(phone)
	params.SetCode(code)

	r, err := client.VerifyV2.CreateVerificationCheck(s.cfg.TwilioServiceSID, params)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error verifying code: %w", err)}
	}
	if *r.Status != "approved" {
		return nil, pkg.UnauthorizedError{Err: errors.New("invalid code")}
	}

	params2 := query.UpdateUserPhoneParams{
		ID:    userID,
		Phone: phone,
	}
	err = s.store.UpdateUserPhone(ctx, params2)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error updating user phone: %w", err)}
	}

	authResponse, err := s.createAuthTokens(ctx, user)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: fmt.Errorf("error creating auth tokens: %w", err)}
	}
	return authResponse, nil
}

func (s *Service) checkUserAccess(_ context.Context, user query.User) (bool, int64, error) {
	subEnd, _ := time.Parse(time.RFC3339, user.SubscriptionEnd.Format(time.RFC3339))
	subscriptionActive := subEnd.After(time.Now())
	return subscriptionActive, user.Access, nil
}

func (s *Service) createAuthTokens(ctx context.Context, user query.User) (*AuthResponse, error) {
	// Check if user has an active subscription
	subscriptionActive, access, err := s.checkUserAccess(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("error checking user access: %w", err)
	}

	// Create refresh token (valid for 30 days)
	id, err := uuid.NewV7()
	if err != nil {
		return nil, fmt.Errorf("error generating UUID: %w", err)
	}
	params2 := query.InsertTokenParams{
		ID:       id.String(),
		Expires:  time.Now().Add(s.cfg.RefreshTokenExp),
		Target:   user.ID.String(),
		Callback: "",
	}
	refreshToken, err := s.store.InsertToken(ctx, params2)
	if err != nil {
		return nil, fmt.Errorf("error inserting refresh token: %w", err)
	}

	// Generate JWT tokens
	jwtToken, jwtRefreshToken, err := s.authService.GenerateTokens(
		refreshToken.ID,
		user.ID.String(),
		access,
		user.Avatar,
		user.Email,
		subscriptionActive,
	)
	if err != nil {
		return nil, fmt.Errorf("error generating JWT token: %w", err)
	}
	return &AuthResponse{
		AccessToken:  jwtToken,
		RefreshToken: jwtRefreshToken,
		ReturnURL:    "",
		User: &AuthUser{
			ID:                 user.ID.String(),
			Access:             access,
			Avatar:             user.Avatar,
			Email:              user.Email,
			SubscriptionActive: subscriptionActive,
		},
		SessionToken: "",
		HasPhone:     false,
	}, nil
}
