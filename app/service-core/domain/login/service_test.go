package login_test

// import (
// 	"errors"
// 	"service-core/auth"
// 	"service-core/domain/email"
// 	"service-core/domain/login"
// 	"service-core/domain/user"
// 	"service-core/config"
// 	systemtesting "service-core/system/testing"
// 	"testing"
// 
// 	"golang.org/x/net/context"
// )

// func TestRefresh(t *testing.T) {
// 	t.Parallel()
// 	// Setup mocks
// 	cfg := system.LoadTestConfig()
// 	authService := auth.NewMockService()
// 	userStore := user.NewMockStore()
// 	loginProvider := login.NewMockProvider()
// 	emailProvider := email.NewMockProvider()
// 
// 	// Create service
// 	s := login.NewService(cfg, authService, userStore, loginProvider, emailProvider)
// 	const mockAccess = 0x0000000000000001
// 
// 	t.Run("ValidAccessToken", func(t *testing.T) {
// 		t.Parallel()
// 		response, err := service.Refresh(context.Background(), "validAccessToken", "validRefreshToken")
// 		// Assertions
// 		systemtesting.IsNull(t, err)
// 		systemtesting.Equals(t, response.AccessToken, "validAccessToken")
// 		systemtesting.Equals(t, response.RefreshToken, "validRefreshToken")
// 		systemtesting.Equals(t, response.User.Email, "admin@gofast.live")
// 		systemtesting.Equals(t, response.User.Access, int64(mockAccess))
// 	})
// 
// 	t.Run("ValidRefreshToken", func(t *testing.T) {
// 		t.Parallel()
// 		response, err := service.Refresh(context.Background(), "invalidToken", "validRefreshToken")
// 		// Assertions
// 		systemtesting.IsNull(t, err)
// 		systemtesting.Equals(t, response.AccessToken, "newAccessToken")
// 		systemtesting.Equals(t, response.RefreshToken, "newRefreshToken")
// 		systemtesting.Equals(t, response.User.Email, "admin@gofast.live")
// 		systemtesting.Equals(t, response.User.Access, int64(mockAccess))
// 	})
// 
// 	t.Run("InvalidRefreshToken", func(t *testing.T) {
// 		t.Parallel()
// 		_, err := service.Refresh(context.Background(), "invalidAccessToken", "invalidRefreshToken")
// 		// Assertions
// 		expectedErr := errors.New("error validating refresh token: Invalid refresh token")
// 		systemtesting.IsNotNull(t, err)
// 		systemtesting.Equals(t, err.Error(), expectedErr.Error())
// 	})
// 
// 	t.Run("ExpiredRefreshToken", func(t *testing.T) {
// 		t.Parallel()
// 		_, err := service.Refresh(context.Background(), "invalidAccessToken", "expiredRefreshToken")
// 		// Assertions
// 		expectedErr := errors.New("token expired: %!w(<nil>)")
// 		systemtesting.IsNotNull(t, err)
// 		systemtesting.Equals(t, err.Error(), expectedErr.Error())
// 	})
// 
// 	t.Run("RevokedRefreshToken", func(t *testing.T) {
// 		t.Parallel()
// 		_, err := service.Refresh(context.Background(), "invalidAccessToken", "revokedRefreshToken")
// 		// Assertions
//         expectedErr := errors.New("token have been revoked")
// 		systemtesting.IsNotNull(t, err)
// 		systemtesting.Equals(t, err.Error(), expectedErr.Error())
// 	})
// 
// 	t.Run("ValidRefreshTokenMissingByID", func(t *testing.T) {
// 		t.Parallel()
// 		_, err := service.Refresh(context.Background(), "invalidAccessToken", "missingID")
// 		// Assertions
// 		expectedErr := errors.New("error selecting token by ID: Invalid token by ID")
// 		systemtesting.IsNotNull(t, err)
// 		systemtesting.Equals(t, err.Error(), expectedErr.Error())
// 	})
// 
// 	t.Run("MissingUserFromTheDatabase", func(t *testing.T) {
// 		t.Parallel()
// 		_, err := service.Refresh(context.Background(), "invalidAccessToken", "missingUser")
// 		// Assertions
// 		expectedErr := errors.New("error selecting user by ID: Missing user")
// 		systemtesting.IsNotNull(t, err)
// 		systemtesting.Equals(t, err.Error(), expectedErr.Error())
// 	})
// }
