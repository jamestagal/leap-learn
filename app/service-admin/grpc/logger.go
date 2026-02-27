package grpc

import (
	"context"
	"log/slog"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func SlogStreamClientInterceptor() grpc.StreamClientInterceptor {
	return func(
		ctx context.Context,
		desc *grpc.StreamDesc,
		cc *grpc.ClientConn,
		method string,
		streamer grpc.Streamer,
		opts ...grpc.CallOption,
	) (grpc.ClientStream, error) {
		slog.Info("gRPC stream initiating",
			slog.String("grpc_method", method),
			slog.String("grpc_target", cc.Target()),
		)

		clientStream, err := streamer(ctx, desc, cc, method, opts...)
		if err != nil {
			slog.Error("gRPC stream failed to initiate",
				slog.String("grpc_method", method),
				slog.String("grpc_target", cc.Target()),
				slog.Any("error", err),
			)
			return nil, err
		}
		return clientStream, nil
	}
}

func SlogUnaryClientInterceptor() grpc.UnaryClientInterceptor {
	return func(
		ctx context.Context,
		method string,
		req, reply any,
		cc *grpc.ClientConn,
		invoker grpc.UnaryInvoker,
		opts ...grpc.CallOption,
	) error {
		startTime := time.Now()

		err := invoker(ctx, method, req, reply, cc, opts...)

		duration := time.Since(startTime)
		statusCode := status.Code(err)

		attrs := []slog.Attr{
			slog.String("grpc_method", method),
			slog.String("grpc_status", statusCode.String()),
			slog.String("grpc_target", cc.Target()),
			slog.Duration("duration", duration),
		}
		logLevel := slog.LevelInfo
		if err != nil {
			if statusCode >= codes.Internal {
				logLevel = slog.LevelError
			} else if statusCode >= codes.InvalidArgument && statusCode < codes.Internal {
				logLevel = slog.LevelWarn
			}
		}
		if err != nil {
			attrs = append(attrs, slog.Any("grpc_error", err))
		}
		slog.LogAttrs(ctx, logLevel, "gRPC call end", attrs...)
		return err
	}
}
