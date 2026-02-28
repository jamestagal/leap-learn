package file

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"service-core/config"
	"sync"

	"cloud.google.com/go/storage"
)

type gcsProvider struct {
	cfg      *config.Config
	client   *storage.Client
	initOnce sync.Once
	initErr  error
}

func newGcsProvider(cfg *config.Config) *gcsProvider {
	return &gcsProvider{
		cfg:      cfg,
		client:   nil,
		initOnce: sync.Once{},
		initErr:  nil,
	}
}

func (p *gcsProvider) getClient(ctx context.Context) (*storage.Client, error) {
	p.initOnce.Do(func() {
		client, err := storage.NewClient(ctx)
		if err != nil {
			p.initErr = fmt.Errorf("error creating GCS client: %w", err)
			return
		}
		p.client = client
	})

	if p.initErr != nil {
		return nil, p.initErr
	}

	if p.client == nil {
		return nil, errors.New("gcs client is nil after initialization without specific error")
	}

	return p.client, nil
}

func (p *gcsProvider) Upload(ctx context.Context, file *File) error {
	client, err := p.getClient(ctx)
	if err != nil {
		return fmt.Errorf("error getting GCS client for upload: %w", err)
	}

	obj := client.Bucket(p.cfg.BucketName).Object(file.Key)
	writer := obj.NewWriter(ctx)
	writer.ContentType = file.ContentType // Set content type if available

	_, err = io.Copy(writer, bytes.NewReader(file.Data))
	if err != nil {
		_ = writer.Close()
		return fmt.Errorf("error writing data to GCS object: %w", err)
	}

	err = writer.Close()
	if err != nil {
		return fmt.Errorf("error closing GCS writer: %w", err)
	}

	return nil
}

func (p *gcsProvider) Download(ctx context.Context, fileKey string) ([]byte, error) {
	client, err := p.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting GCS client for download: %w", err)
	}

	reader, err := client.Bucket(p.cfg.BucketName).Object(fileKey).NewReader(ctx)
	if err != nil {
		return nil, fmt.Errorf("error creating GCS reader for object %s: %w", fileKey, err)
	}
	defer reader.Close()

	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(reader)
	if err != nil {
		return nil, fmt.Errorf("error reading data from GCS object %s: %w", fileKey, err)
	}

	return buf.Bytes(), nil
}

func (p *gcsProvider) Remove(ctx context.Context, fileKey string) error {
	client, err := p.getClient(ctx)
	if err != nil {
		return fmt.Errorf("error getting GCS client for remove: %w", err)
	}

	err = client.Bucket(p.cfg.BucketName).Object(fileKey).Delete(ctx)
	if err != nil {
		return fmt.Errorf("error deleting GCS object %s: %w", fileKey, err)
	}

	return nil
}

func (p *gcsProvider) ListByPrefix(_ context.Context, _ string) ([]string, error) {
	return nil, nil
}
