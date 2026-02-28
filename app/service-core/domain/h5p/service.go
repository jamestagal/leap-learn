package h5p

import (
	"app/pkg"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"service-core/config"
	"service-core/domain/file"
	"service-core/storage/query"
	"time"

	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

// store defines the database interface for H5P operations.
// This will be satisfied by the sqlc-generated Querier once queries are regenerated.
type store interface {
	// Libraries
	GetH5PLibrary(ctx context.Context, id uuid.UUID) (query.H5pLibrary, error)
	GetH5PLibraryByMachineName(ctx context.Context, machineName string) (query.H5pLibrary, error)
	GetH5PLibraryByMachineNameVersion(ctx context.Context, arg query.GetH5PLibraryByMachineNameVersionParams) (query.H5pLibrary, error)
	ListH5PLibraries(ctx context.Context) ([]query.H5pLibrary, error)
	ListH5PRunnableLibraries(ctx context.Context) ([]query.H5pLibrary, error)
	UpsertH5PLibrary(ctx context.Context, arg query.UpsertH5PLibraryParams) (query.H5pLibrary, error)
	DeleteH5PLibrary(ctx context.Context, id uuid.UUID) error
	DeleteH5PLibraryByMachineName(ctx context.Context, machineName string) error

	// Dependencies
	InsertH5PLibraryDependency(ctx context.Context, arg query.InsertH5PLibraryDependencyParams) error
	DeleteH5PLibraryDependencies(ctx context.Context, libraryID uuid.UUID) error

	// Hub cache
	GetH5PHubCache(ctx context.Context, cacheKey string) (query.H5pHubCache, error)
	UpsertH5PHubCache(ctx context.Context, arg query.UpsertH5PHubCacheParams) (query.H5pHubCache, error)
	DeleteExpiredH5PHubCache(ctx context.Context) error

	// Org libraries
	EnableH5POrgLibrary(ctx context.Context, arg query.EnableH5POrgLibraryParams) error
	DisableH5POrgLibrary(ctx context.Context, arg query.DisableH5POrgLibraryParams) error
}

// Service handles H5P library management
type Service struct {
	cfg          *config.Config
	store        store
	fileProvider file.Provider
	hubClient    *HubClient
}

// NewService creates a new H5P service
func NewService(cfg *config.Config, store store, fileProvider file.Provider) *Service {
	hubURL := cfg.H5PHubURL
	if hubURL == "" {
		hubURL = defaultHubURL
	}
	return &Service{
		cfg:          cfg,
		store:        store,
		fileProvider: fileProvider,
		hubClient:    NewHubClient(hubURL),
	}
}

// GetContentTypeCache returns the cached content type list, refreshing from Hub if expired.
// Merges hub data with local install status.
func (s *Service) GetContentTypeCache(ctx context.Context) ([]ContentTypeCacheEntry, error) {
	hubData, err := s.getCachedHubData(ctx)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error fetching content type cache", Err: err}
	}

	// Get all installed libraries to mark install status
	installed, err := s.store.ListH5PRunnableLibraries(ctx)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error listing installed libraries", Err: err}
	}

	installedMap := make(map[string]query.H5pLibrary)
	for _, lib := range installed {
		installedMap[lib.MachineName] = lib
	}

	entries := make([]ContentTypeCacheEntry, 0, len(hubData.ContentTypes))
	for _, ct := range hubData.ContentTypes {
		entry := ContentTypeCacheEntry{
			ID:            ct.ID,
			Title:         ct.Title,
			Summary:       ct.Summary,
			Description:   ct.Description,
			Icon:          ct.Icon,
			MajorVersion:  ct.Version.Major,
			MinorVersion:  ct.Version.Minor,
			PatchVersion:  ct.Version.Patch,
			IsRecommended: ct.IsRecommended,
			Popularity:    ct.Popularity,
			Screenshots:   ct.Screenshots,
			Keywords:      ct.Keywords,
			Categories:    ct.Categories,
			Owner:         ct.Owner,
			Example:       ct.Example,
		}

		if lib, ok := installedMap[ct.ID]; ok {
			entry.Installed = true
			entry.LocalVersion = fmt.Sprintf("%d.%d.%d", lib.MajorVersion, lib.MinorVersion, lib.PatchVersion)
			// Check if hub version is newer
			if ct.Version.Major > int(lib.MajorVersion) ||
				(ct.Version.Major == int(lib.MajorVersion) && ct.Version.Minor > int(lib.MinorVersion)) ||
				(ct.Version.Major == int(lib.MajorVersion) && ct.Version.Minor == int(lib.MinorVersion) && ct.Version.Patch > int(lib.PatchVersion)) {
				entry.UpdateAvailable = true
			}
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

// getCachedHubData returns hub data from cache or fetches fresh
func (s *Service) getCachedHubData(ctx context.Context) (*HubResponse, error) {
	// Try cache first
	cached, err := s.store.GetH5PHubCache(ctx, hubCacheKey)
	if err == nil {
		var hubResp HubResponse
		if err := json.Unmarshal(cached.Data, &hubResp); err == nil {
			return &hubResp, nil
		}
	}

	// Cache miss or invalid — fetch from Hub
	slog.Info("Fetching content types from H5P Hub")
	hubResp, err := s.hubClient.FetchContentTypes()
	if err != nil {
		return nil, fmt.Errorf("fetching from hub: %w", err)
	}

	// Store in cache
	data, err := json.Marshal(hubResp)
	if err != nil {
		slog.Warn("Failed to marshal hub response for cache", "error", err)
		return hubResp, nil // Return data even if caching fails
	}

	_, err = s.store.UpsertH5PHubCache(ctx, query.UpsertH5PHubCacheParams{
		ID:        uuid.New(),
		CacheKey:  hubCacheKey,
		Data:      data,
		ExpiresAt: time.Now().Add(hubCacheTTL),
	})
	if err != nil {
		slog.Warn("Failed to cache hub data", "error", err)
	}

	// Clean up expired entries
	_ = s.store.DeleteExpiredH5PHubCache(ctx)

	return hubResp, nil
}

// InstallLibrary downloads and installs a library from the H5P Hub
func (s *Service) InstallLibrary(ctx context.Context, machineName string) (*LibraryInfo, error) {
	slog.Info("Installing H5P library", "machineName", machineName)

	// Download the .h5p package
	packageData, err := s.hubClient.DownloadPackage(machineName)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error downloading H5P package", Err: err}
	}

	// Extract the package
	extracted, err := ExtractH5PPackage(packageData)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error extracting H5P package", Err: err}
	}

	if len(extracted.Libraries) == 0 {
		return nil, pkg.BadRequestError{Message: "H5P package contains no libraries"}
	}

	// Install each library in the package (main + dependencies)
	var mainLib *query.H5pLibrary
	for _, extLib := range extracted.Libraries {
		lib, err := s.installSingleLibrary(ctx, extLib, packageData, extLib.LibraryJSON.MachineName == machineName)
		if err != nil {
			slog.Warn("Failed to install library from package",
				"machineName", extLib.LibraryJSON.MachineName,
				"error", err)
			continue
		}

		if extLib.LibraryJSON.MachineName == machineName {
			mainLib = lib
		}
	}

	// If the main library wasn't found by machineName match, use the first runnable one
	if mainLib == nil {
		for _, extLib := range extracted.Libraries {
			if extLib.LibraryJSON.Runnable == 1 {
				lib, _ := s.store.GetH5PLibraryByMachineName(ctx, extLib.LibraryJSON.MachineName)
				mainLib = &lib
				break
			}
		}
	}

	if mainLib == nil {
		return nil, pkg.InternalError{Message: "Failed to install main library"}
	}

	return &LibraryInfo{
		ID:           mainLib.ID,
		MachineName:  mainLib.MachineName,
		MajorVersion: mainLib.MajorVersion,
		MinorVersion: mainLib.MinorVersion,
		PatchVersion: mainLib.PatchVersion,
		Title:        mainLib.Title,
		Description:  mainLib.Description,
		Icon:         nullStringValue(mainLib.IconPath),
		Runnable:     mainLib.Runnable,
		Origin:       mainLib.Origin,
		Installed:    true,
	}, nil
}

// installSingleLibrary installs one library to storage and DB
func (s *Service) installSingleLibrary(ctx context.Context, extLib ExtractedLibrary, rawPackage []byte, isMain bool) (*query.H5pLibrary, error) {
	lj := extLib.LibraryJSON

	major := int(lj.MajorVersion)
	minor := int(lj.MinorVersion)
	patch := int(lj.PatchVersion)

	// Upload files to R2/S3 concurrently (up to 20 at a time)
	type uploadItem struct {
		key         string
		contentType string
		data        []byte
	}
	items := make([]uploadItem, 0, len(extLib.Files))
	for relPath, content := range extLib.Files {
		items = append(items, uploadItem{
			key:         LibraryStorageKey(lj.MachineName, major, minor, patch, relPath),
			contentType: detectContentType(relPath),
			data:        content,
		})
	}

	const maxConcurrent = 20
	sem := make(chan struct{}, maxConcurrent)
	errCh := make(chan error, len(items))
	for _, item := range items {
		sem <- struct{}{}
		go func(it uploadItem) {
			defer func() { <-sem }()
			errCh <- s.fileProvider.Upload(ctx, &file.File{
				Key:         it.key,
				ContentType: it.contentType,
				Data:        it.data,
			})
		}(item)
	}
	// Wait for all goroutines to finish
	for range len(items) {
		if err := <-errCh; err != nil {
			return nil, fmt.Errorf("uploading file: %w", err)
		}
	}

	// If this is the main library, also store the raw .h5p package
	var packagePath sql.NullString
	if isMain && rawPackage != nil {
		pkgKey := PackageStorageKey(lj.MachineName, major, minor, patch)
		err := s.fileProvider.Upload(ctx, &file.File{
			Key:         pkgKey,
			ContentType: "application/zip",
			Data:        rawPackage,
		})
		if err != nil {
			slog.Warn("Failed to store raw package", "error", err)
		} else {
			packagePath = sql.NullString{String: pkgKey, Valid: true}
		}
	}

	extractedPath := sql.NullString{
		String: LibraryStorageKey(lj.MachineName, major, minor, patch, ""),
		Valid:  true,
	}

	// Upsert library record
	lib, err := s.store.UpsertH5PLibrary(ctx, query.UpsertH5PLibraryParams{
		ID:            uuid.New(),
		MachineName:   lj.MachineName,
		MajorVersion:  int32(major),
		MinorVersion:  int32(minor),
		PatchVersion:  int32(patch),
		Title:         lj.Title,
		Origin:        "official",
		MetadataJson:  pqtype.NullRawMessage{},
		Categories:    []string{},
		Keywords:      []string{},
		Screenshots:   []string{},
		Description:   lj.Description,
		IconPath:      sql.NullString{},
		PackagePath:   packagePath,
		ExtractedPath: extractedPath,
		Runnable:      lj.Runnable == 1,
		Restricted:    false,
	})
	if err != nil {
		return nil, fmt.Errorf("upserting library %s: %w", lj.MachineName, err)
	}

	// Store dependencies
	if err := s.storeDependencies(ctx, lib.ID, lj); err != nil {
		slog.Warn("Failed to store dependencies", "library", lj.MachineName, "error", err)
	}

	slog.Info("Installed library",
		"machineName", lj.MachineName,
		"version", fmt.Sprintf("%d.%d.%d", major, minor, patch))

	return &lib, nil
}

// storeDependencies saves library dependency relationships
func (s *Service) storeDependencies(ctx context.Context, libraryID uuid.UUID, lj LibraryJSON) error {
	// Clear existing deps
	if err := s.store.DeleteH5PLibraryDependencies(ctx, libraryID); err != nil {
		return err
	}

	saveDeps := func(deps []LibraryDep, depType string) error {
		for _, dep := range deps {
			// Look up the dependency library (it must already be installed)
			depLib, err := s.store.GetH5PLibraryByMachineName(ctx, dep.MachineName)
			if err != nil {
				slog.Debug("Dependency not yet installed", "dep", dep.MachineName, "type", depType)
				continue // Skip deps that aren't installed yet
			}
			err = s.store.InsertH5PLibraryDependency(ctx, query.InsertH5PLibraryDependencyParams{
				ID:             uuid.New(),
				LibraryID:      libraryID,
				DependsOnID:    depLib.ID,
				DependencyType: depType,
			})
			if err != nil {
				return fmt.Errorf("inserting dependency %s: %w", dep.MachineName, err)
			}
		}
		return nil
	}

	if err := saveDeps(lj.PreloadedDependencies, "preloaded"); err != nil {
		return err
	}
	if err := saveDeps(lj.DynamicDependencies, "dynamic"); err != nil {
		return err
	}
	return saveDeps(lj.EditorDependencies, "editor")
}

// ListInstalledLibraries returns all installed libraries
func (s *Service) ListInstalledLibraries(ctx context.Context) ([]LibraryInfo, error) {
	libs, err := s.store.ListH5PLibraries(ctx)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error listing libraries", Err: err}
	}

	result := make([]LibraryInfo, 0, len(libs))
	for _, lib := range libs {
		result = append(result, LibraryInfo{
			ID:           lib.ID,
			MachineName:  lib.MachineName,
			MajorVersion: lib.MajorVersion,
			MinorVersion: lib.MinorVersion,
			PatchVersion: lib.PatchVersion,
			Title:        lib.Title,
			Description:  lib.Description,
			Icon:         nullStringValue(lib.IconPath),
			Runnable:     lib.Runnable,
			Origin:       lib.Origin,
			Installed:    true,
		})
	}

	return result, nil
}

// DeleteLibrary removes a library and its files from storage
func (s *Service) DeleteLibrary(ctx context.Context, machineName string) error {
	lib, err := s.store.GetH5PLibraryByMachineName(ctx, machineName)
	if err != nil {
		return pkg.NotFoundError{Message: "Library not found", Err: err}
	}

	// Remove files from storage
	if lib.PackagePath.Valid {
		if err := s.fileProvider.Remove(ctx, lib.PackagePath.String); err != nil {
			slog.Warn("Failed to remove package file", "path", lib.PackagePath.String, "error", err)
		}
	}
	// Note: extracted files could be cleaned up too, but we'd need to list all keys.
	// For now we just remove the DB record which cascades dependencies.

	if err := s.store.DeleteH5PLibraryByMachineName(ctx, machineName); err != nil {
		return pkg.InternalError{Message: "Error deleting library", Err: err}
	}

	slog.Info("Deleted library", "machineName", machineName)
	return nil
}

// EnableLibraryForOrg enables a platform library for a specific organisation
func (s *Service) EnableLibraryForOrg(ctx context.Context, orgID, libraryID uuid.UUID) error {
	return s.store.EnableH5POrgLibrary(ctx, query.EnableH5POrgLibraryParams{
		ID:        uuid.New(),
		OrgID:     orgID,
		LibraryID: libraryID,
	})
}

// DisableLibraryForOrg disables a platform library for a specific organisation
func (s *Service) DisableLibraryForOrg(ctx context.Context, orgID, libraryID uuid.UUID) error {
	return s.store.DisableH5POrgLibrary(ctx, query.DisableH5POrgLibraryParams{
		OrgID:     orgID,
		LibraryID: libraryID,
	})
}

// nullStringValue returns the string value or empty string for sql.NullString
func nullStringValue(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

// detectContentType returns a MIME type based on file extension
func detectContentType(filePath string) string {
	switch {
	case hasAnySuffix(filePath, ".js"):
		return "application/javascript"
	case hasAnySuffix(filePath, ".css"):
		return "text/css"
	case hasAnySuffix(filePath, ".json"):
		return "application/json"
	case hasAnySuffix(filePath, ".html", ".htm"):
		return "text/html"
	case hasAnySuffix(filePath, ".png"):
		return "image/png"
	case hasAnySuffix(filePath, ".jpg", ".jpeg"):
		return "image/jpeg"
	case hasAnySuffix(filePath, ".gif"):
		return "image/gif"
	case hasAnySuffix(filePath, ".svg"):
		return "image/svg+xml"
	case hasAnySuffix(filePath, ".woff"):
		return "font/woff"
	case hasAnySuffix(filePath, ".woff2"):
		return "font/woff2"
	case hasAnySuffix(filePath, ".ttf"):
		return "font/ttf"
	case hasAnySuffix(filePath, ".eot"):
		return "application/vnd.ms-fontobject"
	default:
		return "application/octet-stream"
	}
}

func hasAnySuffix(s string, suffixes ...string) bool {
	for _, suffix := range suffixes {
		if len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix {
			return true
		}
	}
	return false
}
