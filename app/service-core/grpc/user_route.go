package grpc

import (
	"app/pkg/auth"
	"context"

	pb "service-core/proto"
)

func (s *userServer) GetAllUsers(_ *pb.Empty, stream pb.UserService_GetAllUsersServer) error {
	token := getToken(stream.Context())
	_, err := s.handler.authService.Auth(token, auth.GetUsers)
	if err != nil {
		return writeResponse(err)
	}
	r := s.handler.userService.GetAllUsers(stream.Context(), stream)
	return writeResponse(r)
}

func (s *userServer) GetUserByID(ctx context.Context, id *pb.ID) (*pb.User, error) {
	token := getToken(ctx)
	_, err := s.handler.authService.Auth(token, auth.GetUsers)
	if err != nil {
		return nil, writeResponse(err)
	}
	user, err := s.handler.userService.GetUserByID(ctx, id.GetId())
	if err != nil {
		return nil, writeResponse(err)
	}
	return user, nil
}


func (s *userServer) EditUser(ctx context.Context, in *pb.User) (*pb.User, error) {
	token := getToken(ctx)
	_, err := s.handler.authService.Auth(token, auth.EditUser)
	if err != nil {
		return nil, writeResponse(err)
	}
	user, err := s.handler.userService.EditUser(ctx, in)
	if err != nil {
		return nil, writeResponse(err)
	}
	return user, nil
}
