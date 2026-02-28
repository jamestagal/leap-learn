package rest

import (
	"app/pkg"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

const maxEditorUploadSize = 50 << 20 // 50 MB

// writeAjaxSuccess writes a wrapped {success: true, data: ...} response
func writeAjaxSuccess(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"success": true,
		"data":    data,
	})
}

// writeAjaxError writes a wrapped {success: false, message: ...} response
func writeAjaxError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{
		"success": false,
		"message": message,
	})
}

// handleEditorAjax dispatches editor AJAX requests by method and action
func (h *Handler) handleEditorAjax(w http.ResponseWriter, r *http.Request) {
	// Authenticate
	token := extractAccessToken(r)
	if token == "" {
		writeAjaxError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	claims, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeAjaxError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	action := r.URL.Query().Get("action")

	switch r.Method {
	case http.MethodGet:
		switch action {
		case "content-type-cache":
			h.handleEditorContentTypeCache(w, r)
		case "libraries":
			h.handleEditorLibraryDetail(w, r)
		case "content-hub-metadata-cache":
			h.handleEditorContentHubMetadataCache(w, r)
		default:
			writeAjaxError(w, http.StatusBadRequest, "Unknown GET action: "+action)
		}
	case http.MethodPost:
		switch action {
		case "libraries":
			h.handleEditorLibrariesBulk(w, r)
		case "translations":
			h.handleEditorTranslations(w, r)
		case "files":
			h.handleEditorFileUpload(w, r, claims.ID)
		case "filter":
			h.handleEditorFilter(w, r)
		case "library-install":
			h.handleEditorLibraryInstall(w, r)
		case "library-upload":
			h.handleEditorLibraryUpload(w, r)
		case "content-hub-metadata-cache":
			h.handleEditorContentHubMetadataCache(w, r)
		default:
			writeAjaxError(w, http.StatusBadRequest, "Unknown POST action: "+action)
		}
	default:
		writeAjaxError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// handleEditorContentTypeCache returns content type cache in editor format (unwrapped)
func (h *Handler) handleEditorContentTypeCache(w http.ResponseWriter, r *http.Request) {
	hubInfo, err := h.h5pService.GetEditorContentTypeCache(r.Context())
	if err != nil {
		slog.Error("Error fetching editor content type cache", "error", err)
		writeAjaxError(w, http.StatusInternalServerError, "Error fetching content type cache")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hubInfo)
}

// handleEditorLibraryDetail returns full library details (unwrapped)
func (h *Handler) handleEditorLibraryDetail(w http.ResponseWriter, r *http.Request) {
	machineName := r.URL.Query().Get("machineName")
	majorStr := r.URL.Query().Get("majorVersion")
	minorStr := r.URL.Query().Get("minorVersion")

	if machineName == "" || majorStr == "" || minorStr == "" {
		writeAjaxError(w, http.StatusBadRequest, "machineName, majorVersion, and minorVersion are required")
		return
	}

	major, _ := strconv.Atoi(majorStr)
	minor, _ := strconv.Atoi(minorStr)

	detail, err := h.h5pService.GetEditorLibraryDetail(r.Context(), machineName, major, minor)
	if err != nil {
		slog.Error("Error fetching library detail", "machineName", machineName, "error", err)
		writeAjaxError(w, http.StatusNotFound, "Library not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}

// handleEditorLibrariesBulk returns basic info for multiple libraries (wrapped)
func (h *Handler) handleEditorLibrariesBulk(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeAjaxError(w, http.StatusBadRequest, "Invalid form data")
		return
	}

	libraries := r.Form["libraries[]"]
	if len(libraries) == 0 {
		// Try JSON body fallback
		var body struct {
			Libraries []string `json:"libraries"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			libraries = body.Libraries
		}
	}

	results, err := h.h5pService.GetEditorLibrariesBulk(r.Context(), libraries)
	if err != nil {
		slog.Error("Error fetching libraries bulk", "error", err)
		writeAjaxError(w, http.StatusInternalServerError, "Error fetching libraries")
		return
	}

	writeAjaxSuccess(w, results)
}

// handleEditorTranslations returns translations for multiple libraries (wrapped)
func (h *Handler) handleEditorTranslations(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeAjaxError(w, http.StatusBadRequest, "Invalid form data")
		return
	}

	libraries := r.Form["libraries[]"]
	language := r.FormValue("language")

	if len(libraries) == 0 {
		// Try JSON body fallback
		var body struct {
			Libraries []string `json:"libraries"`
			Language  string   `json:"language"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			libraries = body.Libraries
			if body.Language != "" {
				language = body.Language
			}
		}
	}

	translations, err := h.h5pService.GetEditorTranslations(r.Context(), libraries, language)
	if err != nil {
		slog.Error("Error fetching translations", "error", err)
		writeAjaxError(w, http.StatusInternalServerError, "Error fetching translations")
		return
	}

	writeAjaxSuccess(w, translations)
}

// handleEditorFileUpload handles temp file uploads from the editor (unwrapped)
func (h *Handler) handleEditorFileUpload(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	r.Body = http.MaxBytesReader(w, r.Body, maxEditorUploadSize)
	if err := r.ParseMultipartForm(maxEditorUploadSize); err != nil {
		writeAjaxError(w, http.StatusBadRequest, "File too large (max 50MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeAjaxError(w, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		writeAjaxError(w, http.StatusInternalServerError, "Error reading file")
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	result, err := h.h5pService.UploadTempFile(r.Context(), userID, header.Filename, data, contentType)
	if err != nil {
		slog.Error("Error uploading temp file", "error", err)
		writeAjaxError(w, http.StatusInternalServerError, "Error uploading file")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// handleEditorFilter echoes back the libraryParameters (wrapped, MVP passthrough)
func (h *Handler) handleEditorFilter(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		// Try JSON body
		body, _ := io.ReadAll(r.Body)
		var req map[string]string
		if err := json.Unmarshal(body, &req); err == nil {
			writeAjaxSuccess(w, req["libraryParameters"])
			return
		}
		writeAjaxError(w, http.StatusBadRequest, "Invalid request")
		return
	}

	libraryParams := r.FormValue("libraryParameters")
	writeAjaxSuccess(w, libraryParams)
}

// handleEditorLibraryInstall installs a library from the Hub (wrapped)
func (h *Handler) handleEditorLibraryInstall(w http.ResponseWriter, r *http.Request) {
	machineName := r.URL.Query().Get("id")
	if machineName == "" {
		if err := r.ParseForm(); err == nil {
			machineName = r.FormValue("id")
		}
	}

	if machineName == "" {
		writeAjaxError(w, http.StatusBadRequest, "Library ID (machineName) is required")
		return
	}

	_, err := h.h5pService.InstallLibrary(r.Context(), machineName)
	if err != nil {
		slog.Error("Error installing library via editor", "machineName", machineName, "error", err)
		writeAjaxError(w, http.StatusInternalServerError, "Error installing library")
		return
	}

	// Return updated content type cache
	hubInfo, err := h.h5pService.GetEditorContentTypeCache(r.Context())
	if err != nil {
		writeAjaxSuccess(w, nil)
		return
	}

	writeAjaxSuccess(w, hubInfo)
}

// handleEditorLibraryUpload handles .h5p file upload and install (wrapped)
func (h *Handler) handleEditorLibraryUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxEditorUploadSize)
	if err := r.ParseMultipartForm(maxEditorUploadSize); err != nil {
		writeAjaxError(w, http.StatusBadRequest, "File too large (max 50MB)")
		return
	}

	file, _, err := r.FormFile("h5p")
	if err != nil {
		writeAjaxError(w, http.StatusBadRequest, "No .h5p file uploaded")
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		writeAjaxError(w, http.StatusInternalServerError, "Error reading file")
		return
	}

	// Use the existing installer package extraction
	// Import the h5p package to call ExtractH5PPackage is not needed here
	// since InstallLibrary already handles this via hub download.
	// For direct upload, we need to extract and install manually.
	// The service handles this.
	writeAjaxSuccess(w, map[string]string{"message": "Library upload processing not yet implemented. Use library-install instead."})
	_ = data // TODO: implement direct .h5p package upload
}

// handleEditorContentHubMetadataCache returns metadata for the Hub content type browser.
// Each license MUST have: id, name, versions (array of {id, name, url}).
// The hub client calls license.versions.length, so versions must always be an array.
func (h *Handler) handleEditorContentHubMetadataCache(w http.ResponseWriter, _ *http.Request) {
	ccVersions := []map[string]any{
		{"id": "4.0", "name": "4.0 International", "url": "https://creativecommons.org/licenses/{{id}}/4.0/"},
		{"id": "3.0", "name": "3.0 Unported", "url": "https://creativecommons.org/licenses/{{id}}/3.0/"},
		{"id": "2.5", "name": "2.5 Generic", "url": "https://creativecommons.org/licenses/{{id}}/2.5/"},
		{"id": "2.0", "name": "2.0 Generic", "url": "https://creativecommons.org/licenses/{{id}}/2.0/"},
		{"id": "1.0", "name": "1.0 Generic", "url": "https://creativecommons.org/licenses/{{id}}/1.0/"},
	}
	gplVersions := []map[string]any{
		{"id": "v3", "name": "Version 3", "url": "https://www.gnu.org/licenses/gpl-3.0.html"},
		{"id": "v2", "name": "Version 2", "url": "https://www.gnu.org/licenses/gpl-2.0.html"},
		{"id": "v1", "name": "Version 1", "url": "https://www.gnu.org/licenses/gpl-1.0.html"},
	}

	metadata := map[string]any{
		"levels": []map[string]any{
			{"id": "beginner", "label": "Beginner"},
			{"id": "intermediate", "label": "Intermediate"},
			{"id": "advanced", "label": "Advanced"},
		},
		"disciplines": []map[string]any{},
		"languages":   []map[string]any{},
		"licenses": []map[string]any{
			{"id": "MIT", "name": "MIT License", "versions": []map[string]any{}},
			{"id": "CC BY", "name": "Creative Commons Attribution", "versions": ccVersions},
			{"id": "CC BY-SA", "name": "Creative Commons Attribution-ShareAlike", "versions": ccVersions},
			{"id": "CC BY-ND", "name": "Creative Commons Attribution-NoDerivatives", "versions": ccVersions},
			{"id": "CC BY-NC", "name": "Creative Commons Attribution-NonCommercial", "versions": ccVersions},
			{"id": "CC BY-NC-SA", "name": "Creative Commons Attribution-NonCommercial-ShareAlike", "versions": ccVersions},
			{"id": "CC BY-NC-ND", "name": "Creative Commons Attribution-NonCommercial-NoDerivatives", "versions": ccVersions},
			{"id": "CC0 1.0", "name": "CC0 1.0 Universal", "versions": []map[string]any{}},
			{"id": "GNU GPL", "name": "GNU General Public License", "versions": gplVersions},
			{"id": "PD", "name": "Public Domain", "versions": []map[string]any{}},
			{"id": "ODC PDDL", "name": "Public Domain Dedication and Licence", "versions": []map[string]any{}},
			{"id": "CC PDM", "name": "Public Domain Mark", "versions": []map[string]any{}},
			{"id": "U", "name": "Undisclosed", "versions": []map[string]any{}},
			{"id": "C", "name": "Copyright", "versions": []map[string]any{}},
		},
	}
	writeAjaxSuccess(w, metadata)
}

// handleEditorGetParams returns content parameters for the editor
func (h *Handler) handleEditorGetParams(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeAjaxError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	token := extractAccessToken(r)
	if token == "" {
		writeAjaxError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeAjaxError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Parse content ID from path: /api/v1/h5p/editor/params/{contentId}
	contentIDStr := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/editor/params/")
	contentID, err := uuid.Parse(contentIDStr)
	if err != nil {
		writeAjaxError(w, http.StatusBadRequest, "Invalid content ID")
		return
	}

	orgIDStr := r.URL.Query().Get("orgId")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeAjaxError(w, http.StatusBadRequest, "orgId query parameter is required")
		return
	}

	params, err := h.h5pService.GetContentParams(r.Context(), contentID, orgID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(params)
}

// handleContentRoute dispatches /api/v1/h5p/content (no trailing slash)
func (h *Handler) handleContentRoute(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}
	claims, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.handleContentList(w, r)
	case http.MethodPost:
		h.handleContentCreate(w, r, claims.ID)
	default:
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
	}
}

// handleContentList lists content for an organisation
func (h *Handler) handleContentList(w http.ResponseWriter, r *http.Request) {
	orgIDStr := r.URL.Query().Get("orgId")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "orgId query parameter is required"})
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	limit := int32(50)
	offset := int32(0)
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil {
			limit = int32(v)
		}
	}
	if offsetStr != "" {
		if v, err := strconv.Atoi(offsetStr); err == nil {
			offset = int32(v)
		}
	}

	items, count, err := h.h5pService.ListContent(r.Context(), orgID, limit, offset)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, map[string]any{
		"items": items,
		"total": count,
	}, nil)
}

// handleContentCreate creates a new content item
func (h *Handler) handleContentCreate(w http.ResponseWriter, r *http.Request, userID uuid.UUID) {
	var req struct {
		OrgID       string          `json:"orgId"`
		LibraryName string          `json:"libraryName"`
		Title       string          `json:"title"`
		ContentJSON json.RawMessage `json:"contentJson,omitempty"`
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

	if req.LibraryName == "" || req.Title == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "libraryName and title are required"})
		return
	}

	info, err := h.h5pService.CreateContent(r.Context(), orgID, userID, req.LibraryName, req.Title, req.ContentJSON)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, info, nil)
}

// handleContentCRUDRoute dispatches /api/v1/h5p/content/{id}
func (h *Handler) handleContentCRUDRoute(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)
	if token == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}
	claims, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("unauthorized")})
		return
	}

	// Parse path: /api/v1/h5p/content/{id} or /api/v1/h5p/content/{id}/save
	suffix := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/content/")
	parts := strings.SplitN(suffix, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Content ID is required"})
		return
	}

	contentID, err := uuid.Parse(parts[0])
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid content ID"})
		return
	}

	// Check for sub-route: /api/v1/h5p/content/{id}/save
	if len(parts) == 2 && parts[1] == "save" && r.Method == http.MethodPost {
		h.handleContentSave(w, r, contentID, claims.ID)
		return
	}

	orgIDStr := r.URL.Query().Get("orgId")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "orgId query parameter is required"})
		return
	}

	switch r.Method {
	case http.MethodGet:
		info, err := h.h5pService.GetContent(r.Context(), contentID, orgID)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}
		writeResponse(h.cfg, w, r, info, nil)

	case http.MethodPut:
		var req struct {
			Title       string          `json:"title"`
			Description string          `json:"description"`
			ContentJSON json.RawMessage `json:"contentJson"`
			Tags        []string        `json:"tags"`
			Status      string          `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
			return
		}
		info, err := h.h5pService.UpdateContent(r.Context(), contentID, orgID, req.Title, req.Description, req.ContentJSON, req.Tags, req.Status)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}
		writeResponse(h.cfg, w, r, info, nil)

	case http.MethodDelete:
		err := h.h5pService.DeleteContent(r.Context(), contentID, orgID)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}
		writeResponse(h.cfg, w, r, map[string]bool{"deleted": true}, nil)

	default:
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
	}
}

// handleContentSave saves content from the editor (full save flow)
func (h *Handler) handleContentSave(w http.ResponseWriter, r *http.Request, contentID, userID uuid.UUID) {
	slog.Info("handleContentSave called", "contentID", contentID, "userID", userID)

	var req struct {
		OrgID   string          `json:"orgId"`
		Library string          `json:"library"`
		Params  json.RawMessage `json:"params"`
		Title   string          `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		slog.Error("handleContentSave: invalid request body", "error", err)
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid request body"})
		return
	}
	slog.Info("handleContentSave: parsed request", "orgID", req.OrgID, "library", req.Library, "title", req.Title, "paramsLen", len(req.Params))

	orgID, err := uuid.Parse(req.OrgID)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid orgId"})
		return
	}

	// Parse library name: "H5P.Accordion 1.0" -> "H5P.Accordion"
	libraryName := req.Library
	if parts := strings.SplitN(req.Library, " ", 2); len(parts) > 0 {
		libraryName = parts[0]
	}

	// Default title
	title := req.Title
	if title == "" {
		title = "Untitled"
	}

	info, err := h.h5pService.SaveContentFromEditor(r.Context(), orgID, userID, contentID, libraryName, req.Params, title)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	writeResponse(h.cfg, w, r, info, nil)
}

// handleContentFile serves content files from storage
func (h *Handler) handleContentFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := extractAccessToken(r)
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse: /api/v1/h5p/content-files/{contentId}/{filepath...}
	suffix := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/content-files/")
	parts := strings.SplitN(suffix, "/", 2)
	if len(parts) < 2 {
		http.NotFound(w, r)
		return
	}

	contentID, err := uuid.Parse(parts[0])
	if err != nil {
		http.NotFound(w, r)
		return
	}

	orgIDStr := r.URL.Query().Get("orgId")
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		http.Error(w, "orgId query parameter is required", http.StatusBadRequest)
		return
	}

	filePath := parts[1]
	data, contentType, err := h.h5pService.GetContentFile(r.Context(), contentID, orgID, filePath)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.Write(data)
}

// handleTempFile serves temp files from storage
func (h *Handler) handleTempFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := extractAccessToken(r)
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	_, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse: /api/v1/h5p/temp-files/{path...}
	filePath := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/temp-files/")
	if filePath == "" {
		http.NotFound(w, r)
		return
	}

	data, contentType, err := h.h5pService.GetTempFile(r.Context(), filePath)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.Write(data)
}
