package rest

import (
	"log/slog"
	"net/http"
	"service-core/storage/query"
)

func (h *Handler) handleTasksDeleteTokens(w http.ResponseWriter, r *http.Request) {
	slog.Info("Running Task: Delete Tokens")
	apiKey := r.Header.Get("X-Api-Key")
	if apiKey != h.cfg.TaskToken {
		slog.Error("Invalid API key")
		http.Error(w, "Invalid API key", http.StatusUnauthorized)
		return
	}
	store := query.New(h.storage.Conn)
	err := store.DeleteTokens(r.Context())
	if err != nil {
		slog.Error("Error deleting tokens", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}
