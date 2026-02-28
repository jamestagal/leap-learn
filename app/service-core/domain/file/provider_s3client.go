package file

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Helper functions for S3 and R2 providers
func uploadFileToProvider(ctx context.Context, client *s3.Client, bucketName string, file *File) error {
	_, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(file.Key),
		Body:        bytes.NewReader(file.Data),
		ContentType: aws.String(file.ContentType),
	})
	if err != nil {
		return fmt.Errorf("error uploading file to S3, %w", err)
	}
	return nil
}

func downloadFileFromProvider(ctx context.Context, client *s3.Client, bucketName string, fileKey string) ([]byte, error) {
	output, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(fileKey),
	})
	if err != nil {
		return nil, fmt.Errorf("error downloading file from S3, %w", err)
	}

	buf := new(bytes.Buffer)
	_, err = buf.ReadFrom(output.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading file, %w", err)
	}

	return buf.Bytes(), nil
}

func removeFileFromProvider(ctx context.Context, client *s3.Client, bucketName string, fileKey string) error {
	_, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(fileKey),
	})
	if err != nil {
		return fmt.Errorf("error deleting file from S3, %w", err)
	}

	return nil
}

func listByPrefixFromProvider(ctx context.Context, client *s3.Client, bucketName, prefix string) ([]string, error) {
	output, err := client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(bucketName),
		Prefix: aws.String(prefix),
	})
	if err != nil {
		return nil, fmt.Errorf("error listing objects by prefix: %w", err)
	}
	keys := make([]string, 0, len(output.Contents))
	for _, obj := range output.Contents {
		keys = append(keys, strings.TrimPrefix(*obj.Key, prefix))
	}
	return keys, nil
}
