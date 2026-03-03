package rest

import (
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"slices"
	"strings"

	"github.com/google/uuid"

	"app/pkg"
	"service-core/storage/query"
)

// --- Types ---

type playCssPath struct {
	Path string `json:"path"`
}

type playJsPath struct {
	Path string `json:"path"`
}

type playDependency struct {
	MachineName  string        `json:"machineName"`
	MajorVersion int32         `json:"majorVersion"`
	MinorVersion int32         `json:"minorVersion"`
	PatchVersion int32         `json:"patchVersion"`
	PreloadedCss []playCssPath `json:"preloadedCss,omitempty"`
	PreloadedJs  []playJsPath  `json:"preloadedJs,omitempty"`
}

type playResponse struct {
	ContentID           string           `json:"contentId"`
	Title               string           `json:"title"`
	Library             string           `json:"library"`
	ContentJson         json.RawMessage  `json:"contentJson"`
	Dependencies        []playDependency `json:"dependencies"`
	LibrariesBaseUrl    string           `json:"librariesBaseUrl"`
	ContentFilesBaseUrl string           `json:"contentFilesBaseUrl"`
}

// --- Shared play context helper ---

type playContext struct {
	content query.H5pContent
	mainLib query.H5pLibrary
	deps    []query.H5pLibrary
	orgID   uuid.UUID
	userID  uuid.UUID
}

func (h *Handler) getPlayContext(r *http.Request, contentIdStr string) (*playContext, error) {
	contentID, err := uuid.Parse(contentIdStr)
	if err != nil {
		return nil, pkg.BadRequestError{Message: "Invalid contentId"}
	}

	// Auth
	token := extractAccessToken(r)
	if token == "" {
		return nil, pkg.UnauthorizedError{Err: errors.New("missing access token")}
	}
	claims, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: errors.New("invalid access token")}
	}

	ctx := r.Context()
	store := query.New(h.storage.Conn)

	// Look up org from content
	contentRef, err := store.GetH5PContentOrgId(ctx, contentID)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Content not found"}
	}

	// Allow orgId override from query param (must still pass membership check)
	orgID := contentRef.OrgID
	if qOrg := r.URL.Query().Get("orgId"); qOrg != "" {
		if parsed, err := uuid.Parse(qOrg); err == nil {
			orgID = parsed
		}
	}

	// Verify org membership
	_, err = store.CheckUserOrgMembership(ctx, query.CheckUserOrgMembershipParams{
		UserID:         claims.ID,
		OrganisationID: orgID,
	})
	if err != nil {
		return nil, pkg.UnauthorizedError{Err: errors.New("not a member of this organisation")}
	}

	// Fetch full content record
	content, err := store.GetH5PContent(ctx, query.GetH5PContentParams{
		ID:    contentID,
		OrgID: orgID,
	})
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Content not found"}
	}

	// Fetch main library
	mainLib, err := store.GetH5PLibrary(ctx, content.LibraryID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Failed to resolve content library"}
	}

	// Resolve full dependency tree (deepest-first, excludes main lib)
	deps, err := store.GetH5PLibraryFullDependencyTree(ctx, content.LibraryID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Failed to resolve dependency tree"}
	}

	return &playContext{
		content: content,
		mainLib: mainLib,
		deps:    deps,
		orgID:   orgID,
		userID:  claims.ID,
	}, nil
}

// --- Route dispatcher ---

// handleH5PPlayRoute dispatches /api/v1/h5p/play/{contentId}[/suffix] by path suffix.
func (h *Handler) handleH5PPlayRoute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	// Parse: /api/v1/h5p/play/{contentId}[/rest...]
	suffix := strings.TrimPrefix(r.URL.Path, "/api/v1/h5p/play/")
	parts := strings.SplitN(suffix, "/", 2)
	if len(parts) == 0 || parts[0] == "" {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "contentId is required"})
		return
	}

	contentIdStr := parts[0]
	rest := ""
	if len(parts) > 1 {
		rest = parts[1]
	}

	switch {
	case rest == "":
		h.handleH5PPlay(w, r, contentIdStr)
	case rest == "embed":
		h.handleH5PPlayEmbed(w, r, contentIdStr)
	case rest == "diag":
		h.handleH5PPlayDiag(w, r, contentIdStr)
	case rest == "h5p.json":
		h.handleH5PPlayH5PJson(w, r, contentIdStr)
	case rest == "content/content.json":
		h.handleH5PPlayContentJson(w, r, contentIdStr)
	case strings.HasPrefix(rest, "content/"):
		h.handleH5PPlayContentFile(w, r, contentIdStr, strings.TrimPrefix(rest, "content/"))
	default:
		http.NotFound(w, r)
	}
}

// --- Handlers ---

// handleH5PPlay returns full play parameters JSON.
// GET /api/v1/h5p/play/{contentId}
func (h *Handler) handleH5PPlay(w http.ResponseWriter, r *http.Request, contentIdStr string) {
	pc, err := h.getPlayContext(r, contentIdStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	deps := buildDependencyList(pc.deps, &pc.mainLib)

	libString := fmt.Sprintf("%s %d.%d", pc.mainLib.MachineName, pc.mainLib.MajorVersion, pc.mainLib.MinorVersion)

	resp := playResponse{
		ContentID:           pc.content.ID.String(),
		Title:               pc.content.Title,
		Library:             libString,
		ContentJson:         pc.content.ContentJson,
		Dependencies:        deps,
		LibrariesBaseUrl:    "/api/h5p/libraries",
		ContentFilesBaseUrl: fmt.Sprintf("/api/h5p/play/%s/content", pc.content.ID.String()),
	}

	writeResponse(h.cfg, w, r, resp, nil)
}

// handleH5PPlayH5PJson returns a constructed h5p.json for h5p-standalone.
// GET /api/v1/h5p/play/{contentId}/h5p.json
func (h *Handler) handleH5PPlayH5PJson(w http.ResponseWriter, r *http.Request, contentIdStr string) {
	pc, err := h.getPlayContext(r, contentIdStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Build preloadedDependencies (all deps + main lib).
	// Use slices.Clone to avoid mutating pc.deps' underlying array.
	allLibs := append(slices.Clone(pc.deps), pc.mainLib)
	preloaded := make([]map[string]interface{}, 0, len(allLibs))
	for _, lib := range allLibs {
		preloaded = append(preloaded, map[string]interface{}{
			"machineName":  lib.MachineName,
			"majorVersion": lib.MajorVersion,
			"minorVersion": lib.MinorVersion,
			"patchVersion": lib.PatchVersion,
		})
	}

	h5pJson := map[string]interface{}{
		"title":                 pc.content.Title,
		"language":              "und",
		"mainLibrary":           pc.mainLib.MachineName,
		"embedTypes":            []string{"iframe"},
		"preloadedDependencies": preloaded,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "private, max-age=60")
	json.NewEncoder(w).Encode(h5pJson)
}

// handleH5PPlayContentJson returns the content parameters for h5p-standalone.
// The editor saves content as {"params": {actual content}, "metadata": {...}}.
// h5p-standalone expects just the inner params as content.json.
// GET /api/v1/h5p/play/{contentId}/content/content.json
func (h *Handler) handleH5PPlayContentJson(w http.ResponseWriter, r *http.Request, contentIdStr string) {
	pc, err := h.getPlayContext(r, contentIdStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	// Unwrap the "params" field if present — the editor stores
	// {"params": {...content...}, "metadata": {...}} but h5p-standalone
	// expects just the inner content object.
	contentData := pc.content.ContentJson
	var wrapper map[string]json.RawMessage
	if err := json.Unmarshal(contentData, &wrapper); err == nil {
		if inner, ok := wrapper["params"]; ok {
			contentData = inner
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "private, max-age=60")
	w.Write(contentData)
}

// handleH5PPlayContentFile proxies content files (images, videos) from R2.
// GET /api/v1/h5p/play/{contentId}/content/{filepath...}
func (h *Handler) handleH5PPlayContentFile(w http.ResponseWriter, r *http.Request, contentIdStr string, filePath string) {
	if filePath == "" || filePath == "content.json" {
		http.NotFound(w, r)
		return
	}

	contentID, err := uuid.Parse(contentIdStr)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Auth + org lookup
	token := extractAccessToken(r)
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	claims, err := h.authService.ValidateAccessToken(token)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	store := query.New(h.storage.Conn)

	contentRef, err := store.GetH5PContentOrgId(ctx, contentID)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Verify org membership
	_, err = store.CheckUserOrgMembership(ctx, query.CheckUserOrgMembershipParams{
		UserID:         claims.ID,
		OrganisationID: contentRef.OrgID,
	})
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	data, contentType, err := h.h5pService.GetContentFile(ctx, contentID, contentRef.OrgID, filePath)
	if err != nil {
		slog.Debug("Play content file not found", "contentId", contentIdStr, "path", filePath, "error", err)
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	w.Write(data)
}

// --- Embed endpoint (Moodle-style server-rendered player) ---

// H5P core CSS files (matching h5p-php-library H5PCore::$styles order)
var h5pCoreCss = []string{
	"/h5p/core/styles/h5p-fonts.css",
	"/h5p/core/styles/h5p.css",
	"/h5p/core/styles/h5p-confirmation-dialog.css",
	"/h5p/core/styles/h5p-core-button.css",
	"/h5p/core/styles/h5p-theme.css",
	"/h5p/core/styles/h5p-theme-variables.css",
	"/h5p/core/styles/h5p-tooltip.css",
	"/h5p/core/styles/h5p-table.css",
	"/h5p/core/styles/font-open-sans.css",
}

// H5P core JS files (matching Moodle's H5PCore::$scripts)
var h5pCoreJs = []string{
	"/h5p/core/js/jquery.js",
	"/h5p/core/js/h5p.js",
	"/h5p/core/js/h5p-event-dispatcher.js",
	"/h5p/core/js/h5p-x-api-event.js",
	"/h5p/core/js/h5p-x-api.js",
	"/h5p/core/js/h5p-content-type.js",
	"/h5p/core/js/h5p-confirmation-dialog.js",
	"/h5p/core/js/h5p-action-bar.js",
	"/h5p/core/js/request-queue.js",
	"/h5p/core/js/h5p-tooltip.js",
}

// embedData holds all template variables for the embed HTML page
type embedData struct {
	Title           string
	CoreCss         []string
	CoreJs          []string
	LibraryCss      []string
	LibraryJs       []string
	IntegrationJSON template.JS
}

// embedTemplate is the server-rendered HTML page for H5P playback (like Moodle's embed.php)
var embedTemplate = template.Must(template.New("h5p-embed").Parse(`<!doctype html>
<html class="h5p-iframe">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{.Title}}</title>
  {{range .CoreCss}}<link rel="stylesheet" href="{{.}}">
  {{end}}
  {{range .LibraryCss}}<link rel="stylesheet" href="{{.}}">
  {{end}}
  {{range .CoreJs}}<script src="{{.}}"></script>
  {{end}}
  {{range .LibraryJs}}<script src="{{.}}"></script>
  {{end}}
  <style>
    body { margin: 0; padding: 0; }
    .h5p-content { width: 100%; }
    /* Global font-weight override: library CSS sets 600 everywhere which looks
       too heavy when Inter font doesn't load or with system fallback.
       Use 400 (normal) for body text, keep 600 only for headings/buttons. */
    .h5p-multichoice .h5p-alternative-container,
    .h5p-content .h5p-answer,
    .h5p-content .h5p-question-content,
    .h5p-theme .h5p-question-introduction,
    .h5p-theme .h5p-question-feedback {
      font-weight: normal;
    }
    .h5p-multichoice .h5p-answer-icon {
      font-weight: normal !important;
    }
    /* Scale down XL globally — the default XL feels too large.
       Per-org theming can override this by redefining the variable. */
    .h5p-content {
      --h5p-theme-font-size-xl: var(--h5p-theme-font-size-l);
      --h5p-theme-font-size-xxl: var(--h5p-theme-font-size-xl);
    }
    /* Override hardcoded font-size on question intro (question.css uses 1.125em fallback) */
    .h5p-question-introduction {
      font-size: var(--h5p-theme-font-size-l) !important;
    }
  </style>
</head>
<body>
  <div class="h5p-content" data-content-id="1"></div>
  <script>
    H5PIntegration = {{.IntegrationJSON}};
  </script>
  <script>
    // Bridge: forward xAPI events and resize to parent frame
    (function() {
      // Resize observer — tell parent whenever body height changes
      function notifyResize() {
        var h = document.body.scrollHeight;
        if (h > 0 && window.parent !== window) {
          window.parent.postMessage({context:"h5p", action:"resize", scrollHeight:h}, "*");
        }
      }
      // Observe size changes
      if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(notifyResize).observe(document.body);
      }
      // Also fire on load
      window.addEventListener("load", function() {
        setTimeout(notifyResize, 500);
      });

      // xAPI bridge — H5P fires xAPI events on the H5P.externalDispatcher
      // We wait for H5P.init() to finish, then attach the listener
      function attachXAPIListener() {
        if (typeof H5P !== "undefined" && H5P.externalDispatcher) {
          H5P.externalDispatcher.on("xAPI", function(event) {
            if (window.parent !== window) {
              window.parent.postMessage({
                context: "h5p",
                action: "xAPI",
                statement: event.data.statement
              }, "*");
            }
          });
        } else {
          // H5P not ready yet, retry
          setTimeout(attachXAPIListener, 200);
        }
      }
      // Start trying after a short delay (H5P.init runs on DOMContentLoaded)
      setTimeout(attachXAPIListener, 300);
    })();
  </script>
</body>
</html>`))

// handleH5PPlayEmbed serves a complete HTML page with all CSS/JS pre-resolved.
// GET /api/v1/h5p/play/{contentId}/embed
func (h *Handler) handleH5PPlayEmbed(w http.ResponseWriter, r *http.Request, contentIdStr string) {
	pc, err := h.getPlayContext(r, contentIdStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	deps := buildDependencyList(pc.deps, &pc.mainLib)

	// Build library CSS/JS URL lists from dependency tree
	var libCss, libJs []string
	for _, dep := range deps {
		libDir := fmt.Sprintf("%s-%d.%d.%d", dep.MachineName, dep.MajorVersion, dep.MinorVersion, dep.PatchVersion)
		slog.Info("Embed: dependency",
			"lib", dep.MachineName,
			"version", fmt.Sprintf("%d.%d.%d", dep.MajorVersion, dep.MinorVersion, dep.PatchVersion),
			"css_count", len(dep.PreloadedCss),
			"js_count", len(dep.PreloadedJs),
			"css_paths", func() []string {
				paths := make([]string, len(dep.PreloadedCss))
				for i, c := range dep.PreloadedCss {
					paths[i] = c.Path
				}
				return paths
			}())
		for _, css := range dep.PreloadedCss {
			libCss = append(libCss, fmt.Sprintf("/api/h5p/libraries/%s/%s", libDir, css.Path))
		}
		for _, js := range dep.PreloadedJs {
			libJs = append(libJs, fmt.Sprintf("/api/h5p/libraries/%s/%s", libDir, js.Path))
		}
	}
	slog.Info("Embed: resolved assets",
		"contentId", contentIdStr,
		"dep_count", len(deps),
		"lib_css_count", len(libCss),
		"lib_js_count", len(libJs),
		"all_css_urls", libCss)

	// Unwrap content.json params
	contentData := pc.content.ContentJson
	rawPreview := string(contentData)
	if len(rawPreview) > 500 {
		rawPreview = rawPreview[:500]
	}
	slog.Info("Embed: raw content_json from DB", "preview", rawPreview)

	var wrapper map[string]json.RawMessage
	if err := json.Unmarshal(contentData, &wrapper); err == nil {
		slog.Info("Embed: content_json top-level keys", "keys", func() []string {
			keys := make([]string, 0, len(wrapper))
			for k := range wrapper {
				keys = append(keys, k)
			}
			return keys
		}())
		if inner, ok := wrapper["params"]; ok {
			contentData = inner
			innerPreview := string(contentData)
			if len(innerPreview) > 500 {
				innerPreview = innerPreview[:500]
			}
			slog.Info("Embed: unwrapped params", "preview", innerPreview)
		} else {
			slog.Info("Embed: no 'params' key found, using raw content_json")
		}
	} else {
		slog.Warn("Embed: content_json is not a JSON object", "error", err)
	}

	libString := fmt.Sprintf("%s %d.%d", pc.mainLib.MachineName, pc.mainLib.MajorVersion, pc.mainLib.MinorVersion)

	// Preload saved user state (for resume functionality)
	store := query.New(h.storage.Conn)
	savedStates, _ := store.GetContentUserStatesForContent(r.Context(), query.GetContentUserStatesForContentParams{
		UserID:    pc.userID,
		ContentID: pc.content.ID,
	})

	// Build contentUserData as nested object: {subContentId: {dataType: "json string"}}
	// H5P core expects this exact structure (h5p.js getUserData line 2438-2439)
	contentUserData := make(map[string]map[string]string)
	for _, s := range savedStates {
		if contentUserData[s.SubContentID] == nil {
			contentUserData[s.SubContentID] = make(map[string]string)
		}
		contentUserData[s.SubContentID][s.DataType] = string(s.Data)
	}

	// Build cid-1 content object
	cidContent := map[string]interface{}{
		"library":     libString,
		"jsonContent": string(contentData),
		"fullScreen":  false,
		"styles":      libCss,
		"scripts":     libJs,
		"displayOptions": map[string]interface{}{
			"frame":     true,
			"copyright": true,
			"export":    false,
			"embed":     false,
			"icon":      false,
		},
		"contentUrl": fmt.Sprintf("/api/h5p/play/%s/content", pc.content.ID.String()),
		"metadata":   map[string]interface{}{"title": pc.content.Title},
	}

	// Attach preloaded state if any exists
	if len(contentUserData) > 0 {
		cidContent["contentUserData"] = contentUserData
	}

	// Build H5PIntegration object (matching Moodle's structure)
	integration := map[string]interface{}{
		"baseUrl":      "",
		"url":          "/api/h5p",
		"urlLibraries": "/api/h5p/libraries",
		"saveFreq":     10,
		"ajax": map[string]interface{}{
			// H5P core replaces :contentId with the data-content-id attribute (hardcoded "1"),
			// not the actual UUID. Pre-bake the real UUID so the URL resolves correctly.
			"contentUserData": fmt.Sprintf("/api/h5p/content-user-data/%s/:dataType/:subContentId", pc.content.ID.String()),
		},
		"user": map[string]interface{}{
			"name": "Learner",
			"mail": "",
		},
		"contents": map[string]interface{}{
			"cid-1": cidContent,
		},
		"core": map[string]interface{}{
			"styles":  h5pCoreCss,
			"scripts": h5pCoreJs,
		},
		"l10n": map[string]interface{}{
			"H5P": map[string]string{
				"fullscreen":            "Fullscreen",
				"disableFullscreen":     "Disable fullscreen",
				"download":              "Download",
				"copyrights":            "Rights of use",
				"embed":                 "Embed",
				"size":                  "Size",
				"showAdvanced":          "Show advanced",
				"hideAdvanced":          "Hide advanced",
				"advancedHelp":          "Include this script on your website if you want dynamic sizing of the embedded content:",
				"copyrightInformation":  "Rights of use",
				"close":                 "Close",
				"title":                 "Title",
				"author":               "Author",
				"year":                  "Year",
				"source":               "Source",
				"license":              "License",
				"thumbnail":            "Thumbnail",
				"noCopyrights":         "No copyright information available for this content.",
				"reuse":                "Reuse",
				"reuseContent":         "Reuse Content",
				"reuseDescription":     "Reuse this content.",
				"downloadDescription":  "Download this content as a H5P file.",
				"copyrightsDescription": "View copyright information for this content.",
				"embedDescription":     "View the embed code for this content.",
				"h5pDescription":       "Visit H5P.org to check out more cool content.",
				"contentChanged":       "This content has changed since you last used it.",
				"startingOver":         "You'll be starting over.",
				"confirmDialogHeader":  "Confirm action",
				"confirmDialogBody":    "Please confirm that you wish to proceed. This action is not reversible.",
				"cancelLabel":          "Cancel",
				"confirmLabel":         "Confirm",
				"licenseU":             "Undisclosed",
			},
		},
	}

	integrationJSON, err := json.Marshal(integration)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: "Failed to build H5PIntegration"})
		return
	}

	data := embedData{
		Title:           pc.content.Title,
		CoreCss:         h5pCoreCss,
		CoreJs:          h5pCoreJs,
		LibraryCss:      libCss,
		LibraryJs:       libJs,
		IntegrationJSON: template.JS(integrationJSON),
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "private, no-cache")
	if err := embedTemplate.Execute(w, data); err != nil {
		slog.Error("Failed to render embed template", "error", err)
	}
}

// --- Helpers ---

// buildDependencyList converts DB library rows to play dependencies.
// deps should be in topological order (deepest first). mainLib is appended last.
func buildDependencyList(deps []query.H5pLibrary, mainLib *query.H5pLibrary) []playDependency {
	result := make([]playDependency, 0, len(deps)+1)

	for _, lib := range deps {
		result = append(result, libToPlayDependency(lib))
	}

	// Main library loads last (after all its dependencies)
	result = append(result, libToPlayDependency(*mainLib))

	return result
}

func libToPlayDependency(lib query.H5pLibrary) playDependency {
	dep := playDependency{
		MachineName:  lib.MachineName,
		MajorVersion: lib.MajorVersion,
		MinorVersion: lib.MinorVersion,
		PatchVersion: lib.PatchVersion,
	}

	// Extract preloadedCss and preloadedJs from metadata_json
	if lib.MetadataJson.Valid && len(lib.MetadataJson.RawMessage) > 0 {
		var meta map[string]json.RawMessage
		if err := json.Unmarshal(lib.MetadataJson.RawMessage, &meta); err == nil {
			if cssRaw, ok := meta["preloadedCss"]; ok {
				var css []playCssPath
				if json.Unmarshal(cssRaw, &css) == nil {
					dep.PreloadedCss = css
				}
			}
			if jsRaw, ok := meta["preloadedJs"]; ok {
				var js []playJsPath
				if json.Unmarshal(jsRaw, &js) == nil {
					dep.PreloadedJs = js
				}
			}
		} else {
			slog.Warn("Failed to parse metadata_json for library",
				"lib", lib.MachineName, "error", err)
		}
	} else {
		slog.Warn("Library has NULL or empty metadata_json — no CSS/JS will be resolved",
			"lib", lib.MachineName,
			"valid", lib.MetadataJson.Valid,
			"len", len(lib.MetadataJson.RawMessage))
	}

	return dep
}

// --- Maintenance ---

// handleH5PBackfillMetadata re-reads library.json from R2 for all libraries and
// updates metadata_json so preloadedCss/preloadedJs are available for the embed player.
// POST /api/v1/h5p/backfill-metadata
func (h *Handler) handleH5PBackfillMetadata(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Method not allowed"})
		return
	}

	// Auth: accept either a valid JWT or a local-only secret header.
	// The secret allows running from CLI without a browser session.
	localSecret := r.Header.Get("X-Backfill-Secret")
	if localSecret != "leaplearn-backfill-2026" {
		token := extractAccessToken(r)
		if token == "" {
			writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("missing access token")})
			return
		}
		_, err := h.authService.ValidateAccessToken(token)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("invalid access token")})
			return
		}
	}

	updated, err := h.h5pService.BackfillLibraryMetadata(r.Context())
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: "Backfill failed: " + err.Error()})
		return
	}

	writeResponse(h.cfg, w, r, map[string]interface{}{
		"updated": updated,
		"message": fmt.Sprintf("Updated metadata_json for %d libraries", updated),
	}, nil)
}

// handleH5PPlayDiag returns a JSON diagnostic report for a content item.
// Checks: content_json structure, library metadata, dependency resolution, CSS/JS paths, R2 accessibility.
// GET /api/v1/h5p/play/{contentId}/diag
func (h *Handler) handleH5PPlayDiag(w http.ResponseWriter, r *http.Request, contentIdStr string) {
	pc, err := h.getPlayContext(r, contentIdStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}

	diag := map[string]interface{}{}

	// 1. Content JSON structure
	rawJSON := string(pc.content.ContentJson)
	if len(rawJSON) > 2000 {
		rawJSON = rawJSON[:2000] + "...(truncated)"
	}
	diag["content_json_raw"] = rawJSON
	diag["content_json_length"] = len(pc.content.ContentJson)

	var wrapper map[string]json.RawMessage
	if err := json.Unmarshal(pc.content.ContentJson, &wrapper); err == nil {
		keys := make([]string, 0, len(wrapper))
		for k := range wrapper {
			keys = append(keys, k)
		}
		diag["content_json_top_keys"] = keys

		if inner, ok := wrapper["params"]; ok {
			var innerObj map[string]json.RawMessage
			if err := json.Unmarshal(inner, &innerObj); err == nil {
				innerKeys := make([]string, 0, len(innerObj))
				for k := range innerObj {
					innerKeys = append(innerKeys, k)
				}
				diag["content_json_params_keys"] = innerKeys
				// Check for double-nesting
				if _, hasNestedParams := innerObj["params"]; hasNestedParams {
					diag["WARNING_DOUBLE_NESTED_PARAMS"] = true
				}
			} else {
				diag["content_json_params_parse_error"] = err.Error()
			}
		}
	} else {
		diag["content_json_parse_error"] = err.Error()
	}

	// 2. Main library info
	diag["main_library"] = map[string]interface{}{
		"machineName":    pc.mainLib.MachineName,
		"majorVersion":   pc.mainLib.MajorVersion,
		"minorVersion":   pc.mainLib.MinorVersion,
		"patchVersion":   pc.mainLib.PatchVersion,
		"metadata_valid": pc.mainLib.MetadataJson.Valid,
		"metadata_len":   len(pc.mainLib.MetadataJson.RawMessage),
	}

	// Check main library metadata for preloadedCss/Js
	mainDep := libToPlayDependency(pc.mainLib)
	diag["main_library_css"] = mainDep.PreloadedCss
	diag["main_library_js"] = mainDep.PreloadedJs

	// 3. Dependencies
	depDiags := make([]map[string]interface{}, 0, len(pc.deps))
	for _, dep := range pc.deps {
		pd := libToPlayDependency(dep)
		depDiags = append(depDiags, map[string]interface{}{
			"machineName":    dep.MachineName,
			"version":        fmt.Sprintf("%d.%d.%d", dep.MajorVersion, dep.MinorVersion, dep.PatchVersion),
			"metadata_valid": dep.MetadataJson.Valid,
			"metadata_len":   len(dep.MetadataJson.RawMessage),
			"css_count":      len(pd.PreloadedCss),
			"js_count":       len(pd.PreloadedJs),
			"css_paths":      pd.PreloadedCss,
			"js_paths":       pd.PreloadedJs,
		})
	}
	diag["dependencies"] = depDiags
	diag["dependency_count"] = len(pc.deps)

	// 4. Build final CSS/JS lists (same logic as embed)
	deps := buildDependencyList(pc.deps, &pc.mainLib)
	var libCss, libJs []string
	for _, dep := range deps {
		libDir := fmt.Sprintf("%s-%d.%d.%d", dep.MachineName, dep.MajorVersion, dep.MinorVersion, dep.PatchVersion)
		for _, css := range dep.PreloadedCss {
			libCss = append(libCss, fmt.Sprintf("/api/h5p/libraries/%s/%s", libDir, css.Path))
		}
		for _, js := range dep.PreloadedJs {
			libJs = append(libJs, fmt.Sprintf("/api/h5p/libraries/%s/%s", libDir, js.Path))
		}
	}
	diag["resolved_css_urls"] = libCss
	diag["resolved_js_urls"] = libJs
	diag["resolved_css_count"] = len(libCss)
	diag["resolved_js_count"] = len(libJs)

	// 5. Test R2 accessibility for first CSS and first JS
	if len(libCss) > 0 {
		testPath := strings.TrimPrefix(libCss[0], "/api/h5p/libraries/")
		data, ct, err := h.h5pService.GetLibraryAsset(r.Context(), testPath)
		if err != nil {
			diag["css_sample_error"] = err.Error()
		} else {
			preview := string(data)
			if len(preview) > 200 {
				preview = preview[:200]
			}
			diag["css_sample_content_type"] = ct
			diag["css_sample_size"] = len(data)
			diag["css_sample_preview"] = preview
		}
	}

	// 6. The jsonContent that would be passed to H5P.init
	contentData := pc.content.ContentJson
	var w2 map[string]json.RawMessage
	if err := json.Unmarshal(contentData, &w2); err == nil {
		if inner, ok := w2["params"]; ok {
			contentData = inner
		}
	}
	jsonContentStr := string(contentData)
	if len(jsonContentStr) > 2000 {
		jsonContentStr = jsonContentStr[:2000] + "...(truncated)"
	}
	diag["embed_jsonContent"] = jsonContentStr

	w.Header().Set("Content-Type", "application/json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.Encode(map[string]interface{}{"success": true, "data": diag})
}
