package grpc

import (
	"context"
	"fmt"
	"service-admin/config"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

type Conn struct {
	cfg  *config.Config
	conn *grpc.ClientConn
}

func NewConn(cfg *config.Config) (*Conn, error) {
	var c Conn
	err := c.CreateConn(cfg)
	if err != nil {
		return nil, fmt.Errorf("error creating gRPC connection: %w", err)
	}
	c.cfg = cfg
	return &c, nil
}

func (s *Conn) CreateConn(cfg *config.Config) error {
	if s.conn != nil {
		return nil
	}
	var opts []grpc.DialOption
	streamLoggingInterceptor := SlogStreamClientInterceptor()
	unaryLoggingInterceptor := SlogUnaryClientInterceptor()
	opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	opts = append(opts, grpc.WithStreamInterceptor(streamLoggingInterceptor))
	opts = append(opts, grpc.WithUnaryInterceptor(unaryLoggingInterceptor))
	conn, err := grpc.NewClient(cfg.CoreURI, opts...)
	if err != nil {
		return fmt.Errorf("error dialing: %w", err)
	}
	s.conn = conn
	return nil
}

func (s *Conn) Close() error {
	if s != nil && s.conn != nil {
		err := s.conn.Close()
		if err != nil {
			return fmt.Errorf("error closing gRPC connection: %w", err)
		}
	}
	return nil
}

func streamData[T any](
	ctx context.Context,
	token string,
	timeout time.Duration,
	createStream func(ctx context.Context) (grpc.ServerStreamingClient[T], error),
) ([]*T, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	errCh := make(chan error, 1)
	var data []*T
	ctx = metadata.AppendToOutgoingContext(ctx, "Authorization", token)
	stream, err := createStream(ctx)
	if err != nil {
		return nil, fmt.Errorf("error creating stream: %w", err)
	}
	go func() {
		for {
			res, err := stream.Recv()
			if err != nil && err.Error() == "EOF" {
				errCh <- nil
				break
			}
			if err != nil {
				errCh <- fmt.Errorf("error receiving data: %w", err)
				return
			}
			data = append(data, res)
		}
	}()

	select {
	case err := <-errCh:
		return data, err
	case <-ctx.Done():
		return nil, fmt.Errorf("error streaming data: %w", ctx.Err())
	}
}
