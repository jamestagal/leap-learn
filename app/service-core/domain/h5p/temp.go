package h5p

import (
	"app/pkg"
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"strings"

	"service-core/domain/file"

	"github.com/google/uuid"
)

// UploadTempFile uploads a file to temporary storage and returns metadata
func (s *Service) UploadTempFile(ctx context.Context, userID uuid.UUID, filename string, data []byte, contentType string) (*TempFileResult, error) {
	tempID := uuid.New()
	key := fmt.Sprintf("h5p-temp/%s/%s/%s", userID, tempID, filename)

	err := s.fileProvider.Upload(ctx, &file.File{
		Key:         key,
		ContentType: contentType,
		Data:        data,
	})
	if err != nil {
		return nil, pkg.InternalError{Message: "Error uploading temp file", Err: err}
	}

	result := &TempFileResult{
		Path: fmt.Sprintf("/api/h5p/temp-files/%s/%s/%s", userID, tempID, filename),
		Mime: contentType,
	}

	// Try to detect image dimensions
	if strings.HasPrefix(contentType, "image/") {
		cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
		if err == nil {
			result.Width = cfg.Width
			result.Height = cfg.Height
		}
	}

	return result, nil
}

// GetTempFile downloads a file from temporary storage
func (s *Service) GetTempFile(ctx context.Context, filePath string) ([]byte, string, error) {
	key := "h5p-temp/" + filePath
	data, err := s.fileProvider.Download(ctx, key)
	if err != nil {
		return nil, "", pkg.NotFoundError{Message: "Temp file not found", Err: err}
	}

	contentType := detectContentType(filePath)
	return data, contentType, nil
}
