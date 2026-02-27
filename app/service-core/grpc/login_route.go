package grpc

import (
	"context"
	pb "service-core/proto"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func (s *authServer) Refresh(ctx context.Context, _ *pb.Empty) (*pb.AuthResponse, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Errorf(codes.Unauthenticated, "Missing metadata")
	}
	accessToken := strings.Join(md.Get("access_token"), "")
	refreshToken := strings.Join(md.Get("refresh_token"), "")
	if refreshToken == "" {
		return nil, status.Errorf(codes.InvalidArgument, "Invalid refresh token")
	}

	r, err := s.handler.loginService.Refresh(ctx, accessToken, refreshToken)
	if err != nil {
		return nil, writeResponse(err)
	}
	return &pb.AuthResponse{
		AccessToken:  r.AccessToken,
		RefreshToken: r.RefreshToken,
	}, nil
}
