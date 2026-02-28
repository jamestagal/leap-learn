package file

import (
	"context"
	"service-core/config"
)

type File struct {
	Key         string
	ContentType string
	Data        []byte
}

type Provider interface {
	Upload(ctx context.Context, file *File) error
	Download(ctx context.Context, fileKey string) ([]byte, error)
	Remove(ctx context.Context, fileKey string) error
	ListByPrefix(ctx context.Context, prefix string) ([]string, error)
}

//nolint:ireturn
func NewProvider(cfg *config.Config) Provider {
	switch cfg.FileProvider {
	case "r2":
		return newR2Provider(cfg)
	case "s3":
		return newS3Provider(cfg)
	case "gcs":
		return newGcsProvider(cfg)
	case "azblob":
		return newAzblobProvider(cfg)
	case "local":
		return newLocalProvider(cfg)
	default:
		panic("Invalid provider")
	}
}
