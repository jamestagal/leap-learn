package rest

import (
	"app/pkg"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"service-core/config"
)

func Run(apiHandler *Handler) *http.Server {
	cfg := apiHandler.cfg
	mux := http.NewServeMux()

	// Login and authentication
	mux.HandleFunc("/refresh", apiHandler.handleRefresh)
	mux.HandleFunc("/logout", apiHandler.handleLogout)
	mux.HandleFunc("/login", apiHandler.handleLogin)
	mux.HandleFunc("/login-callback/{provider}", apiHandler.handleLoginCallback)
	mux.HandleFunc("/login-phone", apiHandler.handleLoginPhone)
	mux.HandleFunc("/login-verify", apiHandler.handleLoginVerify)

	// API v1 routes (what the frontend expects)
	mux.HandleFunc("/api/v1/refresh", apiHandler.handleRefresh)
	mux.HandleFunc("/api/v1/logout", apiHandler.handleLogout)
	mux.HandleFunc("/api/v1/login", apiHandler.handleLogin)
	mux.HandleFunc("/api/v1/login-callback/{provider}", apiHandler.handleLoginCallback)
	mux.HandleFunc("/api/v1/login-phone", apiHandler.handleLoginPhone)
	mux.HandleFunc("/api/v1/login-verify", apiHandler.handleLoginVerify)

	// Billing (organisation subscriptions)
	mux.HandleFunc("/api/v1/billing/info", apiHandler.handleBillingInfo)
	mux.HandleFunc("/api/v1/billing/checkout", apiHandler.handleBillingCheckout)
	mux.HandleFunc("/api/v1/billing/portal", apiHandler.handleBillingPortal)
	mux.HandleFunc("/api/v1/billing/upgrade", apiHandler.handleBillingUpgrade)
	mux.HandleFunc("/api/v1/billing/session-status", apiHandler.handleBillingSessionStatus)
	mux.HandleFunc("/api/v1/billing/sync-session", apiHandler.handleBillingSyncSession)
	mux.HandleFunc("/api/v1/billing/webhook", apiHandler.handleBillingWebhook)

	// Cron jobs
	mux.HandleFunc("/tasks/delete-tokens", apiHandler.handleTasksDeleteTokens)

	// Health checks
	mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		err := apiHandler.storage.Conn.PingContext(r.Context())
		if err != nil {
			slog.Error("Error pinging database", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, err = w.Write([]byte("OK"))
		if err != nil {
			panic(err)
		}
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		err := apiHandler.storage.Conn.PingContext(r.Context())
		if err != nil {
			slog.Error("Error pinging database", "error", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, err = w.Write([]byte("OK"))
		if err != nil {
			panic(err)
		}
	})

	// Apply CORS middleware globally
	corsHandler := corsMiddleware(cfg, mux)
	handler := loggingMiddleware(corsHandler)

	server := &http.Server{Addr: ":" + cfg.HTTPPort, Handler: handler, ReadHeaderTimeout: cfg.HTTPTimeout, WriteTimeout: cfg.HTTPTimeout}
	go func() {
		slog.Info("HTTP server listening on", "port", cfg.HTTPPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Error serving HTTP", "error", err)
			panic(err)
		}
	}()
	return server
}

// corsMiddleware handles CORS headers globally
func corsMiddleware(cfg *config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers for all requests
		w.Header().Set("Access-Control-Allow-Origin", cfg.ClientURL)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// Handle preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func extractAccessToken(r *http.Request) string {
	token, err := r.Cookie("access_token")
	if err != nil {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" && len(authHeader) > 7 && authHeader[:7] == "Bearer " {
			return authHeader[7:]
		}
		return authHeader
	}
	return token.Value
}

func writeResponse(cfg *config.Config, w http.ResponseWriter, r *http.Request, data any, err error) {
	w.Header().Set("Access-Control-Allow-Origin", cfg.ClientURL)
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

	if err != nil {
		var unauthorizedError pkg.UnauthorizedError
		var internalError pkg.InternalError
		var badRequestError pkg.BadRequestError
		var notFoundError pkg.NotFoundError
		var validationErrors pkg.ValidationErrors
		switch {
		case errors.As(err, &unauthorizedError):
			slog.Error("Unauthorized", "error", err)
			returnURL := r.FormValue("return_url")
			if returnURL == "" {
				// Return JSON error for API requests
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"message": "Unauthorized",
					"code":    401,
				})
			} else {
				http.Redirect(w, r, returnURL+"/login?error=unauthorized", http.StatusSeeOther)
			}
			return
		case errors.As(err, &internalError):
			slog.Error("Internal error", "error", internalError)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": internalError.Message,
				"code":    500,
			})
			return
		case errors.As(err, &badRequestError):
			slog.Error("Bad request error", "error", badRequestError)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": badRequestError.Message,
				"code":    400,
			})
			return
		case errors.As(err, &notFoundError):
			slog.Error("Not found error", "error", notFoundError)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": notFoundError.Message,
				"code":    404,
			})
			return
		case errors.As(err, &validationErrors):
			slog.Error("Validation error", "error", validationErrors)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnprocessableEntity)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": validationErrors.Error(),
				"code":    422,
			})
			return
		default:
			slog.Error("Error", "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": "An internal error occurred",
				"code":    500,
			})
			return
		}
	}
	if data == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Wrap successful responses in Safe<T> format expected by frontend
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	safeResponse := map[string]interface{}{
		"success": true,
		"data":    data,
		"message": "Operation completed successfully",
	}
	err = json.NewEncoder(w).Encode(safeResponse)
	if err != nil {
		slog.Error("Error writing response", "error", err)
		http.Error(w, "Error writing response", http.StatusInternalServerError)
		return
	}
}