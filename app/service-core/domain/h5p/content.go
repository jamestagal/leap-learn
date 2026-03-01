package h5p

import (
	"app/pkg"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"service-core/domain/file"
	"service-core/storage/query"

	"github.com/google/uuid"
)

var slugRegexp = regexp.MustCompile(`[^a-z0-9]+`)

func generateSlug(title string) string {
	slug := strings.ToLower(title)
	slug = slugRegexp.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "untitled"
	}
	return slug
}

// CreateContent creates a new H5P content item
func (s *Service) CreateContent(ctx context.Context, orgID, userID uuid.UUID, libraryName, title string, contentJSON json.RawMessage) (*ContentInfo, error) {
	lib, err := s.store.GetH5PLibraryByMachineName(ctx, libraryName)
	if err != nil {
		return nil, pkg.NotFoundError{Message: fmt.Sprintf("Library %s not found", libraryName), Err: err}
	}

	contentID := uuid.New()
	slug := generateSlug(title)
	storagePath := fmt.Sprintf("h5p-content/%s/%s/", orgID, contentID)

	if contentJSON == nil {
		contentJSON = json.RawMessage(`{}`)
	}

	content, err := s.store.CreateH5PContent(ctx, query.CreateH5PContentParams{
		ID:          contentID,
		OrgID:       orgID,
		LibraryID:   lib.ID,
		CreatedBy:   uuid.NullUUID{UUID: userID, Valid: true},
		Title:       title,
		Slug:        slug,
		Description: "",
		ContentJson: contentJSON,
		Tags:        []string{},
		FolderPath:  sql.NullString{},
		StoragePath: sql.NullString{String: storagePath, Valid: true},
		Status:      "draft",
	})
	if err != nil {
		return nil, pkg.InternalError{Message: "Error creating content", Err: err}
	}

	return &ContentInfo{
		ID:             content.ID,
		Title:          content.Title,
		Slug:           content.Slug,
		Description:    content.Description,
		Status:         content.Status,
		LibraryID:      lib.ID,
		LibraryName:    lib.MachineName,
		LibraryTitle:   lib.Title,
		LibraryVersion: fmt.Sprintf("%d.%d.%d", lib.MajorVersion, lib.MinorVersion, lib.PatchVersion),
		CreatedAt:      content.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:      content.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

// GetContent returns a single content item
func (s *Service) GetContent(ctx context.Context, contentID, orgID uuid.UUID) (*ContentInfo, error) {
	content, err := s.store.GetH5PContent(ctx, query.GetH5PContentParams{
		ID:    contentID,
		OrgID: orgID,
	})
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Content not found", Err: err}
	}

	lib, err := s.store.GetH5PLibrary(ctx, content.LibraryID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error loading library", Err: err}
	}

	return &ContentInfo{
		ID:             content.ID,
		Title:          content.Title,
		Slug:           content.Slug,
		Description:    content.Description,
		Status:         content.Status,
		LibraryID:      lib.ID,
		LibraryName:    lib.MachineName,
		LibraryTitle:   lib.Title,
		LibraryVersion: fmt.Sprintf("%d.%d.%d", lib.MajorVersion, lib.MinorVersion, lib.PatchVersion),
		CreatedAt:      content.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:      content.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

// UpdateContent updates a content item's title, description, content, tags, and status
func (s *Service) UpdateContent(ctx context.Context, contentID, orgID uuid.UUID, title, description string, contentJSON json.RawMessage, tags []string, status string) (*ContentInfo, error) {
	if tags == nil {
		tags = []string{}
	}
	if status == "" {
		status = "draft"
	}

	content, err := s.store.UpdateH5PContent(ctx, query.UpdateH5PContentParams{
		ID:          contentID,
		OrgID:       orgID,
		Title:       title,
		Description: description,
		ContentJson: contentJSON,
		Tags:        tags,
		Status:      status,
	})
	if err != nil {
		return nil, pkg.InternalError{Message: "Error updating content", Err: err}
	}

	lib, err := s.store.GetH5PLibrary(ctx, content.LibraryID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error loading library", Err: err}
	}

	return &ContentInfo{
		ID:             content.ID,
		Title:          content.Title,
		Slug:           content.Slug,
		Description:    content.Description,
		Status:         content.Status,
		LibraryID:      lib.ID,
		LibraryName:    lib.MachineName,
		LibraryTitle:   lib.Title,
		LibraryVersion: fmt.Sprintf("%d.%d.%d", lib.MajorVersion, lib.MinorVersion, lib.PatchVersion),
		CreatedAt:      content.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:      content.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

// DeleteContent soft-deletes a content item
func (s *Service) DeleteContent(ctx context.Context, contentID, orgID uuid.UUID) error {
	return s.store.SoftDeleteH5PContent(ctx, query.SoftDeleteH5PContentParams{
		ID:    contentID,
		OrgID: orgID,
	})
}

// ListContent returns content items for an organisation with pagination
func (s *Service) ListContent(ctx context.Context, orgID uuid.UUID, limit, offset int32) ([]ContentInfo, int64, error) {
	rows, err := s.store.ListH5PContentByOrg(ctx, query.ListH5PContentByOrgParams{
		OrgID:  orgID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, 0, pkg.InternalError{Message: "Error listing content", Err: err}
	}

	count, err := s.store.CountH5PContentByOrg(ctx, orgID)
	if err != nil {
		return nil, 0, pkg.InternalError{Message: "Error counting content", Err: err}
	}

	items := make([]ContentInfo, 0, len(rows))
	for _, row := range rows {
		items = append(items, ContentInfo{
			ID:             row.ID,
			Title:          row.Title,
			Slug:           row.Slug,
			Description:    row.Description,
			Status:         row.Status,
			LibraryID:      row.LibraryID,
			LibraryName:    row.MachineName,
			LibraryTitle:   row.LibraryTitle,
			LibraryVersion: fmt.Sprintf("%d.%d.%d", row.LibraryMajor, row.LibraryMinor, row.LibraryPatch),
			CreatedAt:      row.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt:      row.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	return items, count, nil
}

// GetContentParams returns the content parameters needed by the editor
func (s *Service) GetContentParams(ctx context.Context, contentID, orgID uuid.UUID) (*EditorContentParams, error) {
	content, err := s.store.GetH5PContent(ctx, query.GetH5PContentParams{
		ID:    contentID,
		OrgID: orgID,
	})
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Content not found", Err: err}
	}

	lib, err := s.store.GetH5PLibrary(ctx, content.LibraryID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error loading library", Err: err}
	}

	libraryString := fmt.Sprintf("%s %d.%d", lib.MachineName, lib.MajorVersion, lib.MinorVersion)

	// Build h5p metadata from library info
	h5pMeta := map[string]any{
		"mainLibrary": lib.MachineName,
		"title":       content.Title,
	}

	// Build preloaded dependencies
	deps, err := s.store.GetH5PLibraryFullDependencyTree(ctx, lib.ID)
	if err == nil && len(deps) > 0 {
		preloadedDeps := make([]map[string]any, 0)
		for _, dep := range deps {
			preloadedDeps = append(preloadedDeps, map[string]any{
				"machineName":  dep.MachineName,
				"majorVersion": dep.MajorVersion,
				"minorVersion": dep.MinorVersion,
			})
		}
		h5pMeta["preloadedDependencies"] = preloadedDeps
	}

	h5pMetaJSON, _ := json.Marshal(h5pMeta)

	return &EditorContentParams{
		H5P:     h5pMetaJSON,
		Library: libraryString,
		Params:  content.ContentJson,
	}, nil
}

// GetContentFile downloads a file from content storage
func (s *Service) GetContentFile(ctx context.Context, contentID, orgID uuid.UUID, filePath string) ([]byte, string, error) {
	content, err := s.store.GetH5PContent(ctx, query.GetH5PContentParams{
		ID:    contentID,
		OrgID: orgID,
	})
	if err != nil {
		return nil, "", pkg.NotFoundError{Message: "Content not found", Err: err}
	}

	key := fmt.Sprintf("h5p-content/%s/%s/%s", content.OrgID, content.ID, filePath)
	data, err := s.fileProvider.Download(ctx, key)
	if err != nil {
		return nil, "", pkg.NotFoundError{Message: "File not found", Err: err}
	}

	contentType := detectContentType(filePath)
	return data, contentType, nil
}

const tempFileSuffix = "#tmp"

// migrateTempFiles scans params for temp file references (paths ending with #tmp),
// copies them to permanent content storage, and returns updated params with rewritten paths.
// Also returns the list of temp R2 keys to clean up after a successful save.
func (s *Service) migrateTempFiles(ctx context.Context, orgID, contentID uuid.UUID, params json.RawMessage) (json.RawMessage, []string, error) {
	paramsStr := string(params)

	// Fast path: no temp refs at all
	if !strings.Contains(paramsStr, tempFileSuffix) {
		return params, nil, nil
	}

	// Collect unique temp paths
	replacements := make(map[string]string) // old path → new path
	var tempKeys []string

	searchFrom := 0
	for {
		idx := strings.Index(paramsStr[searchFrom:], tempFileSuffix)
		if idx == -1 {
			break
		}

		// Walk backwards from #tmp to find the start of the path (after a ")
		pathEnd := searchFrom + idx + len(tempFileSuffix)
		pathStart := strings.LastIndex(paramsStr[:searchFrom+idx], `"`)
		if pathStart == -1 {
			searchFrom = pathEnd
			continue
		}
		pathStart++ // skip the opening "

		oldPath := paramsStr[pathStart:pathEnd]
		searchFrom = pathEnd

		// Skip if already processed
		if _, done := replacements[oldPath]; done {
			continue
		}

		// Strip #tmp suffix to get the relative path: {userID}/{tempID}/{filename}
		relPath := strings.TrimSuffix(oldPath, tempFileSuffix)
		parts := strings.SplitN(relPath, "/", 3)
		if len(parts) != 3 {
			slog.Warn("Malformed temp file path, skipping", "path", oldPath)
			continue
		}
		userID, tempID, filename := parts[0], parts[1], parts[2]

		// Download from temp storage
		srcKey := fmt.Sprintf("h5p-temp/%s/%s/%s", userID, tempID, filename)
		data, err := s.fileProvider.Download(ctx, srcKey)
		if err != nil {
			slog.Warn("Failed to download temp file, skipping", "key", srcKey, "error", err)
			continue
		}

		// Upload to permanent content storage
		permName := tempID + "_" + filename
		dstKey := fmt.Sprintf("h5p-content/%s/%s/%s", orgID, contentID, permName)
		err = s.fileProvider.Upload(ctx, &file.File{
			Key:         dstKey,
			ContentType: detectContentType(filename),
			Data:        data,
		})
		if err != nil {
			return nil, nil, fmt.Errorf("uploading to permanent storage: %w", err)
		}

		// Store just the filename in params. H5P.getPath() will prepend contentUrl.
		replacements[oldPath] = permName
		tempKeys = append(tempKeys, srcKey)
	}

	// Apply replacements
	for old, new_ := range replacements {
		paramsStr = strings.ReplaceAll(paramsStr, old, new_)
	}

	return json.RawMessage(paramsStr), tempKeys, nil
}

// cleanupTempFiles removes temp files from R2 on a best-effort basis.
func (s *Service) cleanupTempFiles(ctx context.Context, keys []string) {
	for _, key := range keys {
		if err := s.fileProvider.Remove(ctx, key); err != nil {
			slog.Warn("Failed to remove temp file", "key", key, "error", err)
		}
	}
}

// SaveContentFromEditor saves content from the H5P editor, moving temp files to permanent storage
func (s *Service) SaveContentFromEditor(ctx context.Context, orgID, userID, contentID uuid.UUID, libraryName string, params json.RawMessage, title string) (*ContentInfo, error) {
	// Resolve library
	lib, err := s.store.GetH5PLibraryByMachineName(ctx, libraryName)
	if err != nil {
		return nil, pkg.NotFoundError{Message: fmt.Sprintf("Library %s not found", libraryName), Err: err}
	}

	// Migrate temp files to permanent storage BEFORE the DB save
	// so the stored params always contain permanent paths.
	savedParams, tempKeys, err := s.migrateTempFiles(ctx, orgID, contentID, params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error migrating temp files", Err: err}
	}

	// Check if content already exists (update) or not (create)
	existing, getErr := s.store.GetH5PContent(ctx, query.GetH5PContentParams{
		ID:    contentID,
		OrgID: orgID,
	})

	storagePath := fmt.Sprintf("h5p-content/%s/%s/", orgID, contentID)

	if getErr != nil {
		// Create new content
		slug := generateSlug(title)
		content, err := s.store.CreateH5PContent(ctx, query.CreateH5PContentParams{
			ID:          contentID,
			OrgID:       orgID,
			LibraryID:   lib.ID,
			CreatedBy:   uuid.NullUUID{UUID: userID, Valid: true},
			Title:       title,
			Slug:        slug,
			Description: "",
			ContentJson: savedParams,
			Tags:        []string{},
			FolderPath:  sql.NullString{},
			StoragePath: sql.NullString{String: storagePath, Valid: true},
			Status:      "draft",
		})
		if err != nil {
			return nil, pkg.InternalError{Message: "Error creating content", Err: err}
		}
		existing = content
	} else {
		// Update existing
		existing, err = s.store.UpdateH5PContent(ctx, query.UpdateH5PContentParams{
			ID:          contentID,
			OrgID:       orgID,
			Title:       title,
			Description: existing.Description,
			ContentJson: savedParams,
			Tags:        existing.Tags,
			Status:      existing.Status,
		})
		if err != nil {
			return nil, pkg.InternalError{Message: "Error updating content", Err: err}
		}
	}

	// Clean up temp files after successful save (best-effort)
	if len(tempKeys) > 0 {
		go s.cleanupTempFiles(context.Background(), tempKeys)
	}

	return &ContentInfo{
		ID:             existing.ID,
		Title:          existing.Title,
		Slug:           existing.Slug,
		Description:    existing.Description,
		Status:         existing.Status,
		LibraryID:      lib.ID,
		LibraryName:    lib.MachineName,
		LibraryTitle:   lib.Title,
		LibraryVersion: fmt.Sprintf("%d.%d.%d", lib.MajorVersion, lib.MinorVersion, lib.PatchVersion),
		CreatedAt:      existing.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:      existing.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}
