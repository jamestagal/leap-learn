package rest

import (
	"app/pkg"
	"encoding/json"
	"errors"
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

// handleH5PDeleteLibrary deletes a library by machine name
func (h *Handler) handleH5PDeleteLibrary(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
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
