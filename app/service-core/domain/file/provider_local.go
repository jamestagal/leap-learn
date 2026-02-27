package file

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"service-core/config"
	"strings"
)

type localProvider struct {
	cfg *config.Config
}

func newLocalProvider(cfg *config.Config) *localProvider {
	return &localProvider{
		cfg: cfg,
	}
}

func (p *localProvider) Upload(_ context.Context, file *File) error {
	err := os.MkdirAll(p.cfg.LocalFileDir, os.ModePerm)
	if err != nil {
		return fmt.Errorf("error creating directory, %w", err)
	}
	fileLocation := strings.ReplaceAll(file.Key, "/", "_")
	f, err := os.Create(fmt.Sprintf("%s/%s", p.cfg.LocalFileDir, fileLocation))
	if err != nil {
		return fmt.Errorf("error creating file, %w", err)
	}
	defer f.Close()
	_, err = f.Write(file.Data)
	if err != nil {
		return fmt.Errorf("error writing to file, %w", err)
	}
	return nil
}

func (p *localProvider) Download(_ context.Context, fileKey string) ([]byte, error) {
	fileLocation := strings.ReplaceAll(fileKey, "/", "_")
	f, err := os.Open(fmt.Sprintf("%s/%s", p.cfg.LocalFileDir, fileLocation))
	if err != nil {
		return nil, fmt.Errorf("error opening file, %w", err)
	}
	defer f.Close()
	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(f)
	if err != nil {
		return nil, fmt.Errorf("error reading file, %w", err)
	}
	return buf.Bytes(), nil
}

func (p *localProvider) Remove(_ context.Context, fileID string) error {
	fileLocation := strings.ReplaceAll(fileID, "/", "_")
	err := os.Remove(fmt.Sprintf("%s/%s", p.cfg.LocalFileDir, fileLocation))
	if err != nil {
		return fmt.Errorf("error removing file, %w", err)
	}
	return nil
}
