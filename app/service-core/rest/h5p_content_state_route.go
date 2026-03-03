package rest

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"app/pkg"
	"service-core/storage/query"
)

// handleContentUserData dispatches GET/POST for H5P content user state.
// URL pattern: /api/v1/h5p/content-user-data/{contentId}/{dataType}/{subContentId}
func (h *Handler) handleContentUserData(w http.ResponseWriter, r *http.Request) {
	// Parse URL path segments
	suffix := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/content-user-data/")
	parts := strings.SplitN(suffix, "/", 3)
	if len(parts) < 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "URL must be /content-user-data/{contentId}/{dataType}/{subContentId}"})
		return
	}

	contentIdStr := parts[0]
	dataType := parts[1]
	subContentId := parts[2]

	contentID, err := uuid.Parse(contentIdStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid contentId"})
		return
	}

	// Auth: extract token → validate → check org membership
	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("missing access token")})
		return
	}
	claims, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("invalid access token")})
		return
	}

	ctx := r.Context()
	store := query.New(h.storage.Conn)

	// Verify content exists
	content, err := store.GetH5PContentOrgId(ctx, contentID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.NotFoundError{Message: "Content not found"})
		return
	}

	// Verify user is an org member
	_, err = store.CheckUserOrgMembership(ctx, query.CheckUserOrgMembershipParams{
		UserID:         claims.ID,
		OrganisationID: content.OrgID,
	})
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("not a member of this organisation")})
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.handleGetContentUserData(w, r, store, claims.ID, contentID, dataType, subContentId)
	case http.MethodPost:
		h.handleSetContentUserData(w, r, store, claims.ID, contentID, dataType, subContentId)
	default:
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
	}
}

func (h *Handler) handleGetContentUserData(w http.ResponseWriter, r *http.Request, store *query.Queries, userID, contentID uuid.UUID, dataType, subContentId string) {
	state, err := store.GetContentUserState(r.Context(), query.GetContentUserStateParams{
		UserID:       userID,
		ContentID:    contentID,
		SubContentID: subContentId,
		DataType:     dataType,
	})

	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// No state saved yet — return data:false so H5P treats it as "no previous state"
			// (data:null means "state was reset" and triggers a "Data Reset" dialog)
			json.NewEncoder(w).Encode(map[string]any{"success": true, "data": false})
			return
		}
		slog.Error("failed to get content user state", "error", err)
		json.NewEncoder(w).Encode(map[string]any{"success": true, "data": false})
		return
	}

	// Return the stored JSON data as a string (H5P core expects a string, not parsed JSON)
	json.NewEncoder(w).Encode(map[string]any{"success": true, "data": string(state.Data)})
}

func (h *Handler) handleSetContentUserData(w http.ResponseWriter, r *http.Request, store *query.Queries, userID, contentID uuid.UUID, dataType, subContentId string) {
	// H5P sends form-encoded data, NOT JSON
	if err := r.ParseForm(); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid form data"})
		return
	}

	dataStr := r.FormValue("data")
	preloadStr := r.FormValue("preload")
	invalidateStr := r.FormValue("invalidate")

	ctx := r.Context()
	w.Header().Set("Content-Type", "application/json")

	// Handle invalidation: H5P sends invalidate=1 in two cases:
	// 1. deleteUserData() — data is "0" or empty → DELETE the saved state
	// 2. setUserData(deleteOnChange:true) — data is actual JSON → SAVE the data
	//    (invalidate flag means "delete this state when content changes", not "delete now")
	if invalidateStr == "1" && (dataStr == "" || dataStr == "0") {
		err := store.DeleteContentUserState(ctx, query.DeleteContentUserStateParams{
			UserID:       userID,
			ContentID:    contentID,
			SubContentID: subContentId,
			DataType:     dataType,
		})
		if err != nil {
			slog.Error("failed to delete content user state", "error", err)
		}
		json.NewEncoder(w).Encode(map[string]any{"success": true})
		return
	}

	// Validate data is valid JSON before storing in JSONB column
	if dataStr == "" || dataStr == "0" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "data field is required"})
		return
	}
	if !json.Valid([]byte(dataStr)) {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "data field must be valid JSON"})
		return
	}

	preload := preloadStr == "1"

	_, err := store.UpsertContentUserState(ctx, query.UpsertContentUserStateParams{
		UserID:       userID,
		ContentID:    contentID,
		SubContentID: subContentId,
		DataType:     dataType,
		Data:         json.RawMessage(dataStr),
		Preload:      preload,
	})
	if err != nil {
		slog.Error("failed to upsert content user state", "error", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]any{"success": false})
		return
	}

	json.NewEncoder(w).Encode(map[string]any{"success": true})
}
