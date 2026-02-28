package file

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"service-core/config"
	"sync"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/blob"
)

type azblobProvider struct {
	cfg      *config.Config
	client   *azblob.Client
	initOnce sync.Once
	initErr  error
}

func newAzblobProvider(cfg *config.Config) *azblobProvider {
	return &azblobProvider{
		cfg: cfg,
		client: nil,
		initOnce: sync.Once{},
		initErr:  nil,
	}
}

func (p *azblobProvider) getClient(_ context.Context) (*azblob.Client, error) {
	p.initOnce.Do(func() {
		credential, err := azblob.NewSharedKeyCredential(p.cfg.AzblobAccountName, p.cfg.AzblobAccountKey)
		if err != nil {
			p.initErr = fmt.Errorf("invalid Azure credentials: %w", err)
			return
		}

		serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net/", p.cfg.AzblobAccountName)
		client, err := azblob.NewClientWithSharedKeyCredential(serviceURL, credential, nil)
		if err != nil {
			p.initErr = fmt.Errorf("error creating Azure Blob client: %w", err)
			return
		}
		p.client = client
	})

	if p.initErr != nil {
		return nil, p.initErr
	}

	if p.client == nil {
		return nil, errors.New("azure blob client is nil after initialization without specific error")
	}

	return p.client, nil
}

func (p *azblobProvider) Upload(ctx context.Context, file *File) error {
	client, err := p.getClient(ctx)
	if err != nil {
		return fmt.Errorf("error getting Azure Blob client for upload: %w", err)
	}

	uploadOptions := &azblob.UploadBufferOptions{
		HTTPHeaders: &blob.HTTPHeaders{
			BlobContentType: &file.ContentType,
		},
	}

	_, err = client.UploadBuffer(ctx, p.cfg.BucketName, file.Key, file.Data, uploadOptions)
	if err != nil {
		return fmt.Errorf("error uploading buffer to Azure Blob: %w", err)
	}

	return nil
}

func (p *azblobProvider) Download(ctx context.Context, fileKey string) ([]byte, error) {
	client, err := p.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting Azure Blob client for download: %w", err)
	}

	get, err := client.DownloadStream(ctx, p.cfg.BucketName, fileKey, nil)
	if err != nil {
		return nil, fmt.Errorf("error initiating download stream from Azure Blob for %s: %w", fileKey, err)
	}

	body := get.Body
	defer body.Close()

	downloadedData := bytes.Buffer{}
	_, err = io.Copy(&downloadedData, body)
	if err != nil {
		return nil, fmt.Errorf("error reading download stream from Azure Blob for %s: %w", fileKey, err)
	}

	return downloadedData.Bytes(), nil
}

func (p *azblobProvider) Remove(ctx context.Context, fileKey string) error {
	client, err := p.getClient(ctx)
	if err != nil {
		return fmt.Errorf("error getting Azure Blob client for remove: %w", err)
	}

	_, err = client.DeleteBlob(ctx, p.cfg.BucketName, fileKey, nil)
	if err != nil {
		return fmt.Errorf("error deleting blob %s from Azure Blob: %w", fileKey, err)
	}

	return nil
}

func (p *azblobProvider) ListByPrefix(_ context.Context, _ string) ([]string, error) {
	return nil, nil
}
