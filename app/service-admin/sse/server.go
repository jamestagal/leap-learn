package sse

import (
	"fmt"
	"log/slog"
	"net/http"
)

func Run(h *Handler) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/sse", h.handleSSE)

	server := &http.Server{
		Handler:           mux,
		Addr:              ":" + h.cfg.SSEPort,
		ReadHeaderTimeout: h.cfg.ReadTimeout,
		IdleTimeout:       h.cfg.IdleTimeout,
		WriteTimeout:      0,
	}
	go func() {
		slog.Info("SSE server listening on", "port", h.cfg.SSEPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Error serving SSE", "error", err)
			panic(err)
		}
	}()
	return server
}

func (h *Handler) handleSSE(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Set required headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", h.cfg.AdminURL)
	w.Header().Set("Access-Control-Allow-Credentials", "true")

	// Get flusher
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	// Send initial message to establish connection
	_, err := fmt.Fprintf(w, "data: Connected to SSE server\n\n")
	if err != nil {
		slog.Error("Error writing to response writer", "error", err)
		return
	}
	flusher.Flush()

	// Extract userID
	accessToken, err := r.Cookie("access_token")
	if err != nil {
		accessToken = &http.Cookie{Value: ""}
	}
	u, err := h.authService.ValidateAccessToken(accessToken.Value)
	if err != nil {
		slog.Debug("User not authenticated")
		<-ctx.Done()
		return
	}

	client := h.broker.Subscribe(u.ID.String())
	defer h.broker.Unsubscribe(client)

	for {
		select {
		case <-ctx.Done():
			slog.Debug("Client disconnected")
			return
		case message := <-client.Ch:
			_, err := fmt.Fprint(w, message)
			if err != nil {
				slog.Error("Error writing to response writer", "error", err)
				return
			}
			flusher.Flush()
		}
	}
}
