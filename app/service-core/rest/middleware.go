package rest

import (
	"app/pkg"
	"app/pkg/auth"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

// contextKey is a typed key for context values to avoid collisions.
type contextKey string

const userContextKey contextKey = "user"

// Middleware types
type Middleware func(http.HandlerFunc) http.HandlerFunc

// AuthMiddleware adds authentication to requests
func AuthMiddleware(authService *auth.Service, requiredAccess int64) Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			accessToken := extractAccessToken(r)

			user, err := authService.Auth(accessToken, requiredAccess)
			if err != nil {
				writeResponse(nil, w, r, nil, err)
				return
			}

			// Add user to context
			ctx := context.WithValue(r.Context(), userContextKey, user)
			r = r.WithContext(ctx)

			next(w, r)
		}
	}
}

// RateLimitMiddleware implements basic rate limiting
func RateLimitMiddleware(requestsPerMinute int) Middleware {
	// Simple in-memory rate limiter
	// In production, this would use Redis or similar distributed cache
	var mu sync.Mutex
	clients := make(map[string][]time.Time)

	// Periodic cleanup of stale IPs to prevent unbounded map growth
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			mu.Lock()
			now := time.Now()
			for ip, requests := range clients {
				var valid []time.Time
				for _, t := range requests {
					if now.Sub(t) < time.Minute {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(clients, ip)
				} else {
					clients[ip] = valid
				}
			}
			mu.Unlock()
		}
	}()

	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			clientIP := getClientIP(r)
			now := time.Now()

			mu.Lock()

			// Clean old entries
			if requests, exists := clients[clientIP]; exists {
				var validRequests []time.Time
				for _, reqTime := range requests {
					if now.Sub(reqTime) < time.Minute {
						validRequests = append(validRequests, reqTime)
					}
				}
				clients[clientIP] = validRequests
			}

			// Check rate limit
			if len(clients[clientIP]) >= requestsPerMinute {
				mu.Unlock()
				writeResponse(nil, w, r, nil, pkg.BadRequestError{
					Message: "Rate limit exceeded",
					Err:     fmt.Errorf("too many requests from %s", clientIP),
				})
				return
			}

			// Add current request
			clients[clientIP] = append(clients[clientIP], now)

			mu.Unlock()

			next(w, r)
		}
	}
}

// CORSMiddleware handles CORS headers
func CORSMiddleware(allowedOrigins []string) Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check if origin is allowed
			allowed := false
			for _, allowedOrigin := range allowedOrigins {
				if allowedOrigin == "*" || allowedOrigin == origin {
					allowed = true
					break
				}
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Max-Age", "86400")

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next(w, r)
		}
	}
}

// LoggingMiddleware logs HTTP requests
func LoggingMiddleware() Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Create a response writer that captures status code
			wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

			next(wrapped, r)

			duration := time.Since(start)

			slog.Info("HTTP request",
				"method", r.Method,
				"path", r.URL.Path,
				"query", r.URL.RawQuery,
				"status", wrapped.statusCode,
				"duration", duration,
				"user_agent", r.Header.Get("User-Agent"),
				"remote_addr", getClientIP(r),
			)
		}
	}
}

// ContentTypeMiddleware validates and sets content type
func ContentTypeMiddleware() Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// For POST/PUT requests, require JSON content type
			if r.Method == http.MethodPost || r.Method == http.MethodPut {
				contentType := r.Header.Get("Content-Type")
				if !strings.Contains(contentType, "application/json") {
					writeResponse(nil, w, r, nil, pkg.BadRequestError{
						Message: "Content-Type must be application/json",
						Err:     fmt.Errorf("invalid content type: %s", contentType),
					})
					return
				}
			}

			next(w, r)
		}
	}
}

// SecurityHeadersMiddleware adds security headers
func SecurityHeadersMiddleware() Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

			next(w, r)
		}
	}
}

// Chain combines multiple middlewares
func Chain(middlewares ...Middleware) Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc {
		for i := len(middlewares) - 1; i >= 0; i-- {
			next = middlewares[i](next)
		}
		return next
	}
}

// Helper functions

// getClientIP extracts the real client IP from request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		// Take the first IP in the list
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP header
	xri := r.Header.Get("X-Real-IP")
	if xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// GetUserFromContext extracts the authenticated user from request context
func GetUserFromContext(r *http.Request) (*auth.AccessTokenClaims, bool) {
	user, ok := r.Context().Value(userContextKey).(*auth.AccessTokenClaims)
	return user, ok
}

// RequireAuth is a helper that ensures a user is authenticated
func RequireAuth(w http.ResponseWriter, r *http.Request) (*auth.AccessTokenClaims, bool) {
	user, ok := GetUserFromContext(r)
	if !ok {
		writeResponse(nil, w, r, nil, pkg.UnauthorizedError{
			Err: fmt.Errorf("authentication required"),
		})
		return nil, false
	}
	return user, true
}

