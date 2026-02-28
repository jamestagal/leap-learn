package rest

import (
	"app/pkg"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// handleH5PContentTypeCache returns the cached content type list from H5P Hub
func (h *Handler) handleH5PContentTypeCache(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	// Require authentication
	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}

	entries, err := h.h5pService.GetContentTypeCache(r.Context())
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, entries, nil)
}

// handleH5PInstall installs a library from the H5P Hub
func (h *Handler) handleH5PInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	// Require authentication
	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}

	var req struct {
		MachineName string `json:"machineName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
		return
	}

	if req.MachineName == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "machineName is required"})
		return
	}

	lib, err := h.h5pService.InstallLibrary(r.Context(), req.MachineName)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, lib, nil)
}

// handleH5PLibraries lists all installed H5P libraries
func (h *Handler) handleH5PLibraries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	// Require authentication
	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}

	libs, err := h.h5pService.ListInstalledLibraries(r.Context())
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, libs, nil)
}

// handleH5PLibraryRoute dispatches /api/v1/h5p/libraries/ by HTTP method:
// GET  → serve extracted library assets (unauthenticated)
// DELETE → delete a library (authenticated)
func (h *Handler) handleH5PLibraryRoute(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.handleH5PLibraryAsset(w, r)
	case http.MethodDelete:
		h.handleH5PDeleteLibrary(w, r)
	default:
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
	}
}

// handleH5PDeleteLibrary deletes a library by machine name (authenticated)
func (h *Handler) handleH5PDeleteLibrary(w http.ResponseWriter, r *http.Request) {
	// Require authentication
	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}

	// Extract machine name from URL path: /api/v1/h5p/libraries/{machineName}
	machineName := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/libraries/")
	if machineName == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "machineName is required"})
		return
	}

	err = h.h5pService.DeleteLibrary(r.Context(), machineName)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, map[string]bool{"deleted": true}, nil)
}

// handleH5PLibraryAsset serves files from extracted libraries (unauthenticated).
// GET /api/v1/h5p/libraries/{machineName}-{version}/{filepath...}
func (h *Handler) handleH5PLibraryAsset(w http.ResponseWriter, r *http.Request) {
	assetPath := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/libraries/")
	if assetPath == "" {
		http.NotFound(w, r)
		return
	}

	data, contentType, err := h.h5pService.GetLibraryAsset(r.Context(), assetPath)
	if err != nil {
		slog.Debug("Library asset not found", "path", assetPath, "error", err)
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Write(data)
}

// handleH5PHubContentTypesRoute dispatches /api/v1/h5p/hub/content-types/ by method:
// POST (exact path) → hub registry
// GET  (with suffix) → package download
func (h *Handler) handleH5PHubContentTypesRoute(w http.ResponseWriter, r *http.Request) {
	suffix := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/hub/content-types/")

	switch {
	case r.Method == http.MethodPost && suffix == "":
		h.handleH5PHubContentTypes(w, r)
	case r.Method == http.MethodGet && suffix != "":
		h.handleH5PHubContentTypeDownload(w, r, suffix)
	default:
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
	}
}

// handleH5PHubRegister handles POST /api/v1/h5p/hub/register (unauthenticated).
// Echoes back the uuid or generates a new one.
func (h *Handler) handleH5PHubRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	_ = r.ParseForm()
	uid := r.FormValue("uuid")
	if uid == "" {
		uid = uuid.New().String()
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"uuid": uid})
}

// handleH5PHubContentTypes handles POST /api/v1/h5p/hub/content-types/ (unauthenticated).
// Returns the full hub registry in Catharsis format.
func (h *Handler) handleH5PHubContentTypes(w http.ResponseWriter, r *http.Request) {
	_ = r.ParseForm()

	registry, err := h.h5pService.GetHubRegistry(r.Context(), h.cfg.CoreURL)
	if err != nil {
		slog.Error("Error fetching hub registry", "error", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Failed to fetch content types"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(registry)
}

// handleH5PHubContentTypeDownload handles GET /api/v1/h5p/hub/content-types/{machineName} (unauthenticated).
// Returns the .h5p package for an already-installed library.
func (h *Handler) handleH5PHubContentTypeDownload(w http.ResponseWriter, r *http.Request, machineName string) {
	data, err := h.h5pService.GetLibraryPackage(r.Context(), machineName)
	if err != nil {
		slog.Debug("Library package not found", "machineName", machineName, "error", err)
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+machineName+".h5p\"")
	w.Write(data)
}

// handleH5POrgLibraryEnable enables a library for an organisation
func (h *Handler) handleH5POrgLibraryEnable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}

	var req struct {
		OrgID     string `json:"orgId"`
		LibraryID string `json:"libraryId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
		return
	}

	orgID, err := uuid.Parse(req.OrgID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid orgId"})
		return
	}
	libraryID, err := uuid.Parse(req.LibraryID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid libraryId"})
		return
	}

	err = h.h5pService.EnableLibraryForOrg(r.Context(), orgID, libraryID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, map[string]bool{"enabled": true}, nil)
}

// handleH5POrgLibraryDisable disables a library for an organisation
func (h *Handler) handleH5POrgLibraryDisable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}

	var req struct {
		OrgID     string `json:"orgId"`
		LibraryID string `json:"libraryId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
		return
	}

	orgID, err := uuid.Parse(req.OrgID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid orgId"})
		return
	}
	libraryID, err := uuid.Parse(req.LibraryID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid libraryId"})
		return
	}

	err = h.h5pService.DisableLibraryForOrg(r.Context(), orgID, libraryID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, map[string]bool{"disabled": true}, nil)
}
