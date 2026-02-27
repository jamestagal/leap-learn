package file_test

// import (
// 	"context"
// 	"fmt"
// 	"os"
// 	"service-core/domain/file"
// 	"service-core/config"
// 	systemtesting "service-core/system/testing"
// 	"testing"
// )
// 
// func checkEnvVariables(provider string, variables []string) error {
// 	for _, v := range variables {
// 		if os.Getenv(v) == "" {
// 			return fmt.Errorf("missing %s environment variable %s", provider, v)
// 		}
// 	}
// 	return nil
// }
// 
// func setupS3() error {
// 	return checkEnvVariables("s3", []string{"S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_REGION", "BUCKET_NAME",
// 		"FILE_PROVIDER"})
// }
// 
// func setupR2() error {
// 	return checkEnvVariables("r2", []string{"R2_ACCESS_KEY", "R2_SECRET_KEY", "R2_ENDPOINT", "BUCKET_NAME",
// 		"FILE_PROVIDER"})
// }
// 
// func setupGCS() error {
// 	return checkEnvVariables("gcs", []string{"BUCKET_NAME", "FILE_PROVIDER", "GOOGLE_APPLICATION_CREDENTIALS"})
// }
// 
// func setupAzblob() error {
// 	return checkEnvVariables("r2", []string{"AZBLOB_ACCOUNT_NAME", "AZBLOB_ACCOUNT_KEY", "BUCKET_NAME", "FILE_PROVIDER"})
// }
// 
// func setupProvider(t *testing.T, setupFunc func() error) *file.Strategy {
// 	t.Helper()
// 	if err := setupFunc(); err != nil {
// 		t.Logf("Failed to setup provider: %v", err)
// 		t.SkipNow()
// 	}
// 	config := system.LoadTestConfig()
// 	return file.NewProvider(config, file.Provider(config.FileProvider))
// }
// 
// func TestS3Provider(t *testing.T) {
// 	t.Parallel()
// 	runProviderTests(t, setupS3)
// }
// 
// func TestR2Provider(t *testing.T) {
// 	t.Parallel()
// 	runProviderTests(t, setupR2)
// }
// 
// func TestGcsProvider(t *testing.T) {
// 	t.Parallel()
// 	runProviderTests(t, setupGCS)
// }
// 
// func TestAzblobProvider(t *testing.T) {
// 	t.Parallel()
// 	runProviderTests(t, setupAzblob)
// }
// 
// func runProviderTests(t *testing.T, setupFunc func() error) {
// 	t.Helper()
// 	t.Run("UploadFileToProvider", func(t *testing.T) {
// 		t.Parallel()
// 		provider := setupProvider(t, setupFunc)
// 		file := &file.File{
// 			ID:          "myfilename.txt",
// 			Created:     "",
// 			Updated:     "",
// 			UserID:      "",
// 			FileName:    "",
// 			FileSize:    "",
// 			ContentType: "text/plain",
// 			Data:        []byte("hello world"),
// 		}
// 		_, err := provider.Upload(context.Background(), file)
// 		if err != nil {
// 			t.Fatalf("%v", err)
// 		}
// 	})
// 	t.Run("DownloadFileToProvider", func(t *testing.T) {
// 		t.Parallel()
// 		provider := setupProvider(t, setupFunc)
// 		body, err := provider.Download(context.Background(), "myfilename.txt")
// 		if err != nil {
// 			t.Fatalf("%v", err)
// 		}
// 		systemtesting.Equals(t, string(body), "hello world")
// 	})
// 	t.Run("RemoveFileFromProvider", func(t *testing.T) {
// 		t.Parallel()
// 		provider := setupProvider(t, setupFunc)
// 		err := provider.Remove(context.Background(), "myfilename.txt")
// 		if err != nil {
// 			t.Fatalf("%v", err)
// 		}
// 	})
// }
