package file

import (
	"app/pkg"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"service-core/config"
	"service-core/storage/query"
	"time"

	"github.com/google/uuid"
)

type store interface {
	SelectFiles(ctx context.Context, userID uuid.UUID) ([]query.File, error)
	SelectFile(ctx context.Context, id uuid.UUID) (query.File, error)
	InsertFile(ctx context.Context, params query.InsertFileParams) (query.File, error)
	DeleteFile(ctx context.Context, id uuid.UUID) error
}

type provider interface {
	Upload(ctx context.Context, file *File) error
	Download(ctx context.Context, fileKey string) ([]byte, error)
	Remove(ctx context.Context, fileKey string) error
}

type Service struct {
	cfg      *config.Config
	store    store
	provider provider
}

func NewService(
	cfg *config.Config,
	store store,
	provider provider,
) *Service {
	return &Service{
		cfg:      cfg,
		store:    store,
		provider: provider,
	}
}

func (s *Service) GetFiles(
	ctx context.Context,
	userID uuid.UUID,
) ([]query.File, error) {
	empty := make([]query.File, 0)
	files, err := s.store.SelectFiles(ctx, userID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error selecting files by user ID", Err: err}
	}
	if len(files) == 0 {
		return empty, nil
	}
	return files, nil
}

func (s *Service) UploadFiles(
	ctx context.Context,
	userID uuid.UUID,
	files []*multipart.FileHeader,
) error {
	ctx, cancel := context.WithTimeout(ctx, s.cfg.ContextTimeout)
	defer cancel()

	errorChan := make(chan error)
	fileChan := make(chan query.InsertFileParams)

	var limit = 200 * time.Millisecond
	limiter := time.NewTicker(limit)
	for _, file := range files {
		f, err := file.Open()
		if err != nil {
			return pkg.InternalError{Message: "Error opening file", Err: err}
		}
		defer f.Close()

		data := make([]byte, file.Size)
		_, err = f.Read(data)
		if err != nil && !errors.Is(err, io.EOF) {
			return pkg.InternalError{Message: "Error reading file", Err: err}
		}

		id, err := uuid.NewV7()
		if err != nil {
			return pkg.InternalError{Message: "Error generating UUID", Err: err}
		}

		fileKey := userID.String() + "/" + id.String()
		upload := &File{
			Key:         fileKey,
			ContentType: file.Header.Get("Content-Type"),
			Data:        data,
		}
		params := query.InsertFileParams{
			ID:          id,
			UserID:      userID,
			FileKey:     fileKey,
			FileName:    file.Filename,
			FileSize:    file.Size,
			ContentType: file.Header.Get("Content-Type"),
		}

		// Validate the file
		err = validate(params, data)
		if err != nil {
			return err
		}

		// Upload the file to the provider
		go func() {
			err := s.provider.Upload(ctx, upload)
			if err != nil {
				errorChan <- pkg.InternalError{Message: "Error uploading file to provider", Err: err}
				return
			}
			fileChan <- params
		}()
		<-limiter.C
	}

	// We upload the files using goroutines
	// When the file is uploaded, it is send back to the channel
	// The returned file is then inserted into the database
	i := 0
	for {
		select {
		case <-ctx.Done():
			return errors.New("deadline exceeded")
		case err := <-errorChan:
			if err != nil {
				return pkg.InternalError{Message: "Error uploading file to provider", Err: err}
			}
			return nil
		case in := <-fileChan:
			_, err := s.store.InsertFile(ctx, in)
			if err != nil {
				return pkg.InternalError{Message: "Error inserting file", Err: err}
			}
			i++
			if i == len(files) {
				return nil
			}
		}
	}
}

func (s *Service) DownloadFile(
	ctx context.Context,
	fileID uuid.UUID,
) (*query.File, []byte, error) {
	ctx, cancel := context.WithTimeout(ctx, s.cfg.ContextTimeout)
	defer cancel()

	// Select the file by ID
	file, err := s.store.SelectFile(ctx, fileID)
	if err != nil {
		return nil, nil, pkg.NotFoundError{Message: "Error selecting file by ID", Err: err}
	}

	// Download the file from the provider
	dataChan := make(chan []byte, 1)
	errChan := make(chan error, 1)
	go func() {
		d, err := s.provider.Download(ctx, file.FileKey)
		if err != nil {
			errChan <- pkg.InternalError{Message: "Error downloading file from provider", Err: err}
			return
		}
		dataChan <- d
	}()

	select {
	case <-ctx.Done():
		return nil, nil, pkg.InternalError{Message: "Timeout downloading file from provider", Err: ctx.Err()}
	case err := <-errChan:
		return nil, nil, err
	case d := <-dataChan:
		if d == nil {
			return nil, nil, pkg.InternalError{Message: "Error downloading file from provider", Err: nil}
		}
		return &file, d, nil
	}
}


func (s *Service) RemoveFile(
	ctx context.Context,
	fileID uuid.UUID,
) error {
	ctx, cancel := context.WithTimeout(ctx, s.cfg.ContextTimeout)
	defer cancel()

	// Select the file by ID
	file, err := s.store.SelectFile(ctx, fileID)
	if err != nil {
		return pkg.NotFoundError{Message: "Error selecting file by ID", Err: err}
	}

	// Remove the file from the provider
	errorChan := make(chan error, 1)
	go func() {
		err = s.provider.Remove(ctx, file.FileKey)
		if err != nil {
			errorChan <- pkg.InternalError{Message: "Error removing file from provider", Err: err}
		}
		errorChan <- nil
	}()

	// After the file is removed from the provider, we delete it from the database
	for {
		select {
		case <-ctx.Done():
			return pkg.InternalError{Message: "Timeout removing file from provider", Err: ctx.Err()}
		case err := <-errorChan:
			if err != nil {
				return pkg.InternalError{Message: "Error removing file from provider", Err: err}
			}
			// Delete the file from the database
			err = s.store.DeleteFile(ctx, file.ID)
			if err != nil {
				return pkg.InternalError{Message: "Error deleting file by ID", Err: err}
			}
			return nil
		}
	}
}
