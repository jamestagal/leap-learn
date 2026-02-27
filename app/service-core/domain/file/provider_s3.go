package file

import (
	"context"
	"errors"
	"fmt"
	"service-core/config"
	"sync"

	s3Config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type s3Provider struct {
	cfg      *config.Config
	client   *s3.Client
	initOnce sync.Once
	initErr  error
}

func newS3Provider(cfg *config.Config) *s3Provider {
	return &s3Provider{
		cfg:      cfg,
		client:   nil,
		initOnce: sync.Once{},
		initErr:  nil,
	}
}

func (p *s3Provider) getClient(ctx context.Context) (*s3.Client, error) {
	p.initOnce.Do(func() {
		s3Cfg, err := s3Config.LoadDefaultConfig(ctx,
			s3Config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(p.cfg.S3AccessKey, p.cfg.S3SecretKey, "")),
			s3Config.WithRegion(p.cfg.S3Region),
		)
		if err != nil {
			p.initErr = fmt.Errorf("error loading S3 configuration: %w", err)
			return
		}
		p.client = s3.NewFromConfig(s3Cfg)
	})
	if p.initErr != nil {
		return nil, p.initErr
	}
	if p.client == nil {
		return nil, errors.New("s3 client is nil after initialization without specific error")
	}
	return p.client, nil
}

func (p *s3Provider) Upload(ctx context.Context, file *File) error {
	client, err := p.getClient(ctx)
	if err != nil {
		return fmt.Errorf("error getting S3 client for upload: %w", err)
	}
	return uploadFileToProvider(ctx, client, p.cfg.BucketName, file)
}

func (p *s3Provider) Download(ctx context.Context, fileKey string) ([]byte, error) {
	client, err := p.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting S3 client for download: %w", err)
	}
	return downloadFileFromProvider(ctx, client, p.cfg.BucketName, fileKey)
}

func (p *s3Provider) Remove(ctx context.Context, fileKey string) error {
	client, err := p.getClient(ctx)
	if err != nil {
		return fmt.Errorf("error getting S3 client for remove: %w", err)
	}
	return removeFileFromProvider(ctx, client, p.cfg.BucketName, fileKey)
}
