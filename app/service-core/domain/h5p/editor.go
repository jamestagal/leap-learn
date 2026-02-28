package h5p

import (
	"app/pkg"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"path"
	"strings"

	"service-core/storage/query"
)

// libraryJSONFull is the full library.json with CSS/JS asset paths
type libraryJSONFull struct {
	LibraryJSON
	PreloadedCss []assetPath `json:"preloadedCss,omitempty"`
	PreloadedJs  []assetPath `json:"preloadedJs,omitempty"`
}

type assetPath struct {
	Path string `json:"path"`
}

// GetEditorLibraryDetail returns full library details for the editor
func (s *Service) GetEditorLibraryDetail(ctx context.Context, machineName string, majorVersion, minorVersion int) (*EditorLibraryDetail, error) {
	lib, err := s.store.GetH5PLibraryByMachineNameVersion(ctx, query.GetH5PLibraryByMachineNameVersionParams{
		MachineName:  machineName,
		MajorVersion: int32(majorVersion),
		MinorVersion: int32(minorVersion),
		PatchVersion: 0, // We need to find the latest patch version
	})
	if err != nil {
		// Try without patch version constraint — find any version with this major.minor
		libs, listErr := s.store.ListH5PLibraries(ctx)
		if listErr != nil {
			return nil, pkg.NotFoundError{Message: fmt.Sprintf("Library %s %d.%d not found", machineName, majorVersion, minorVersion), Err: err}
		}
		found := false
		for _, l := range libs {
			if l.MachineName == machineName && l.MajorVersion == int32(majorVersion) && l.MinorVersion == int32(minorVersion) {
				lib = l
				found = true
				break
			}
		}
		if !found {
			return nil, pkg.NotFoundError{Message: fmt.Sprintf("Library %s %d.%d not found", machineName, majorVersion, minorVersion)}
		}
	}

	version := fmt.Sprintf("%d.%d.%d", lib.MajorVersion, lib.MinorVersion, lib.PatchVersion)
	basePath := path.Join("h5p-libraries", "extracted", machineName+"-"+version)

	// Download library.json
	libJSONData, err := s.fileProvider.Download(ctx, basePath+"/library.json")
	if err != nil {
		return nil, pkg.InternalError{Message: "Error reading library.json", Err: err}
	}

	var libJSON libraryJSONFull
	if err := json.Unmarshal(libJSONData, &libJSON); err != nil {
		return nil, pkg.InternalError{Message: "Error parsing library.json", Err: err}
	}

	// Download semantics.json
	var semantics json.RawMessage
	semanticsData, err := s.fileProvider.Download(ctx, basePath+"/semantics.json")
	if err != nil {
		slog.Debug("No semantics.json found", "library", machineName, "error", err)
		semantics = json.RawMessage(`[]`)
	} else {
		semantics = semanticsData
	}

	// Resolve dependencies recursively and collect their CSS/JS first
	css := make([]string, 0)
	js := make([]string, 0)

	translations := make(map[string]json.RawMessage)

	deps, depErr := s.store.GetH5PLibraryFullDependencyTree(ctx, lib.ID)
	if depErr == nil {
		depNames := make([]string, len(deps))
		for i, d := range deps {
			depNames[i] = fmt.Sprintf("%s-%d.%d.%d", d.MachineName, d.MajorVersion, d.MinorVersion, d.PatchVersion)
		}
		slog.Info("Resolved dependency tree", "library", machineName, "count", len(deps), "order", depNames)
		for _, dep := range deps {
			depVersion := fmt.Sprintf("%d.%d.%d", dep.MajorVersion, dep.MinorVersion, dep.PatchVersion)
			depBase := path.Join("h5p-libraries", "extracted", dep.MachineName+"-"+depVersion)
			depAssetBase := fmt.Sprintf("/api/h5p/libraries/%s-%s", dep.MachineName, depVersion)

			// Read dependency's library.json for its CSS/JS assets
			depLibData, err := s.fileProvider.Download(ctx, depBase+"/library.json")
			if err != nil {
				slog.Debug("Skipping dependency assets", "dep", dep.MachineName, "error", err)
				continue
			}
			var depLibJSON libraryJSONFull
			if err := json.Unmarshal(depLibData, &depLibJSON); err != nil {
				continue
			}
			for _, c := range depLibJSON.PreloadedCss {
				css = append(css, depAssetBase+"/"+c.Path)
			}
			for _, j := range depLibJSON.PreloadedJs {
				js = append(js, depAssetBase+"/"+j.Path)
			}

			// Load dependency's en.json translation
			depLangKey := depBase + "/language/en.json"
			depLangData, err := s.fileProvider.Download(ctx, depLangKey)
			if err == nil {
				translations[dep.MachineName] = depLangData
			}
		}
	} else {
		slog.Debug("Error resolving dependencies", "library", machineName, "error", depErr)
	}

	// Add the main library's CSS/JS after dependencies
	assetBase := fmt.Sprintf("/api/h5p/libraries/%s-%s", machineName, version)
	for _, c := range libJSON.PreloadedCss {
		css = append(css, assetBase+"/"+c.Path)
	}
	for _, j := range libJSON.PreloadedJs {
		js = append(js, assetBase+"/"+j.Path)
	}

	slog.Info("Library assets collected", "library", machineName, "jsCount", len(js), "cssCount", len(css), "jsFiles", js)

	// Discover available language files
	langPrefix := basePath + "/language/"
	langFiles, err := s.fileProvider.ListByPrefix(ctx, langPrefix)
	if err != nil {
		slog.Debug("Error listing language files", "library", machineName, "error", err)
	}

	languages := make([]string, 0)
	var currentLang any // JSON string of current language file, or nil

	for _, f := range langFiles {
		if strings.HasSuffix(f, ".json") {
			lang := strings.TrimSuffix(f, ".json")
			languages = append(languages, lang)
		}
	}

	// Load the English language file as a JSON string
	// h5peditor.js expects language to be a JSON string (it calls JSON.parse on it)
	// defaultLanguage should be null per Lumi reference implementation
	enData, err := s.fileProvider.Download(ctx, langPrefix+"en.json")
	if err == nil {
		currentLang = string(enData)
	}

	return &EditorLibraryDetail{
		Name:  machineName,
		Title: lib.Title,
		Version: HubVersion{
			Major: int(lib.MajorVersion),
			Minor: int(lib.MinorVersion),
			Patch: int(lib.PatchVersion),
		},
		CSS:             css,
		JavaScript:      js,
		Semantics:       semantics,
		Language:        currentLang,
		Languages:       languages,
		DefaultLanguage: nil, // null per Lumi reference — h5peditor.js checks !== null before parsing
		Translations:    translations,
	}, nil
}

// GetEditorLibrariesBulk returns basic info for multiple libraries (POST action=libraries)
func (s *Service) GetEditorLibrariesBulk(ctx context.Context, libraryStrings []string) ([]map[string]any, error) {
	libs, err := s.store.ListH5PLibraries(ctx)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error listing libraries", Err: err}
	}

	results := make([]map[string]any, 0, len(libraryStrings))

	for _, libStr := range libraryStrings {
		// Parse "H5P.Accordion 1.0" format
		parts := strings.SplitN(strings.TrimSpace(libStr), " ", 2)
		if len(parts) < 2 {
			continue
		}
		machineName := parts[0]
		versionParts := strings.Split(parts[1], ".")
		if len(versionParts) < 2 {
			continue
		}

		var major, minor int
		fmt.Sscanf(versionParts[0], "%d", &major)
		fmt.Sscanf(versionParts[1], "%d", &minor)

		for _, lib := range libs {
			if lib.MachineName == machineName && lib.MajorVersion == int32(major) && lib.MinorVersion == int32(minor) {
				result := map[string]any{
					"uberName":     fmt.Sprintf("%s %d.%d", machineName, major, minor),
					"name":         machineName,
					"title":        lib.Title,
					"majorVersion": lib.MajorVersion,
					"minorVersion": lib.MinorVersion,
					"patchVersion": lib.PatchVersion,
					"runnable":     lib.Runnable,
					"restricted":   lib.Restricted,
				}
				results = append(results, result)
				break
			}
		}
	}

	return results, nil
}

// GetEditorTranslations returns language translations for multiple libraries
func (s *Service) GetEditorTranslations(ctx context.Context, libraryStrings []string, language string) (map[string]json.RawMessage, error) {
	if language == "" {
		language = "en"
	}

	libs, err := s.store.ListH5PLibraries(ctx)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error listing libraries", Err: err}
	}

	translations := make(map[string]json.RawMessage)

	for _, libStr := range libraryStrings {
		parts := strings.SplitN(strings.TrimSpace(libStr), " ", 2)
		if len(parts) < 2 {
			continue
		}
		machineName := parts[0]
		versionStr := parts[1]

		versionParts := strings.Split(versionStr, ".")
		if len(versionParts) < 2 {
			continue
		}
		var major, minor int
		fmt.Sscanf(versionParts[0], "%d", &major)
		fmt.Sscanf(versionParts[1], "%d", &minor)

		for _, lib := range libs {
			if lib.MachineName == machineName && lib.MajorVersion == int32(major) && lib.MinorVersion == int32(minor) {
				version := fmt.Sprintf("%d.%d.%d", lib.MajorVersion, lib.MinorVersion, lib.PatchVersion)
				langKey := path.Join("h5p-libraries", "extracted", machineName+"-"+version, "language", language+".json")
				langData, err := s.fileProvider.Download(ctx, langKey)
				if err == nil {
					translations[libStr] = langData
				}
				break
			}
		}
	}

	return translations, nil
}

// GetEditorContentTypeCache returns the content type cache in editor format
func (s *Service) GetEditorContentTypeCache(ctx context.Context) (*IHubInfo, error) {
	entries, err := s.GetContentTypeCache(ctx)
	if err != nil {
		return nil, err
	}

	return &IHubInfo{
		APIVersion:   HubVersion{Major: 1, Minor: 26},
		Details:      []any{},
		Libraries:    entries,
		Outdated:     false,
		RecentlyUsed: []string{},
		User:         "anonymous",
	}, nil
}
