package rest

import (
	"fmt"
	"log/slog"
	"net/http"
	"service-admin/web/pages"
)

func Run(h *Handler) *http.Server {
	mux := http.NewServeMux()

	// Main
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("web/static"))))
	mux.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte("OK"))
		if err != nil {
			panic(err)
		}
	})
	mux.HandleFunc("/error", func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		message := r.URL.Query().Get("message")
		err := pages.ErrorPage(h.cfg, status, message).Render(r.Context(), w)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// Login
	mux.HandleFunc("/login", h.handleLogin)
	mux.HandleFunc("/login/phone", h.handleLoginPhone)
	mux.HandleFunc("/login/verify", h.handleLoginVerify)

	// Home
	mux.HandleFunc("/", h.handleHome)
	mux.HandleFunc("/broadcast", h.handleBroadcast)

	// Notes
	mux.HandleFunc("/notes", h.handleNotes)

	// Users
	mux.HandleFunc("/users", h.handleUsers)
	mux.HandleFunc("/users/calculate-access", h.handleCalculateAccess)

	handler := loggingMiddleware(mux)

	server := &http.Server{
		Handler:           handler,
		Addr:              ":" + h.cfg.HTTPPort,
		ReadHeaderTimeout: h.cfg.ReadTimeout,
		IdleTimeout:       h.cfg.IdleTimeout,
		WriteTimeout:      h.cfg.WriteTimeout,
	}
	go func() {
		slog.Info("REST server listening on", "port", h.cfg.HTTPPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Error serving HTTP", "error", err)
			panic(err)
		}
	}()
	return server
}

func handleError(w http.ResponseWriter, r *http.Request, status int, message string, err error) {
	slog.Error("Error", "status", status, "message", message, "error", err)
	isHTMX := r.Header.Get("Hx-Request") == "true"
	if isHTMX {
		w.Header().Set("Hx-Redirect", fmt.Sprintf("/error?status=%d&message=%s", status, message))
	} else {
		http.Redirect(w, r, fmt.Sprintf("/error?status=%d&message=%s", status, message), http.StatusSeeOther)
	}
}
