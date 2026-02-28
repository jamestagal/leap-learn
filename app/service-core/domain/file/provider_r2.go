package file

import (
	"context"
	"errors"
	"fmt"
	"service-core/config"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3Config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type r2Provider struct {
	cfg      *config.Config
	client   *s3.Client
	initOnce sync.Once
	initErr  error
}

func newR2Provider(cfg *config.Config) *r2Provider {
	return &r2Provider{
		cfg: cfg,
		client: nil,
		initOnce: sync.Once{},
		initErr:  nil,
	}
}

func (p *r2Provider) getClient(ctx context.Context) (*s3.Client, error) {
	p.initOnce.Do(func() {
		s3Cfg, err := s3Config.LoadDefaultConfig(ctx,
			s3Config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(p.cfg.R2AccessKey, p.cfg.R2SecretKey, "")),
			s3Config.WithRegion("auto"), // R2 specific
		)
		if err != nil {
			p.initErr = fmt.Errorf("error loading R2 configuration: %w", err)
			return
		}

		client := s3.NewFromConfig(s3Cfg, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(p.cfg.R2Endpoint) // R2 specific endpoint
		})
		p.client = client
	})

	if p.initErr != nil {
		return nil, p.initErr
	}

	if p.client == nil {
		return nil, errors.New("r2 client is nil after initialization without specific error")
	}

	return p.client, nil
}

func (p *r2Provider) Upload(ctx context.Context, file *File) error {
	client, err := p.getClient(ctx)
	if err != nil {
		return fmt.Errorf("error getting R2 client for upload: %w", err)
	}
	return uploadFileToProvider(ctx, client, p.cfg.BucketName, file)
}

func (p *r2Provider) Download(ctx context.Context, fileKey string) ([]byte, error) {
	client, err := p.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting R2 client for download: %w", err)
	}
	return downloadFileFromProvider(ctx, client, p.cfg.BucketName, fileKey)
}

func (p *r2Provider) Remove(ctx context.Context, fileKey string) error {
	client, err := p.getClient(ctx)
	if err != nil {
		return fmt.Errorf("error getting R2 client for remove: %w", err)
	}
	return removeFileFromProvider(ctx, client, p.cfg.BucketName, fileKey)
}

func (p *r2Provider) ListByPrefix(ctx context.Context, prefix string) ([]string, error) {
	client, err := p.getClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting R2 client for list: %w", err)
	}
	return listByPrefixFromProvider(ctx, client, p.cfg.BucketName, prefix)
}
