package grpc

import (
	"context"
	"fmt"

	pb "service-admin/proto"

	"google.golang.org/grpc/metadata"
)

func (c *Conn) GetAllUsers(ctx context.Context, token string) ([]*pb.User, error) {
	createStream := func(ctx context.Context) (pb.UserService_GetAllUsersClient, error) {
		client := pb.NewUserServiceClient(c.conn)
		return client.GetAllUsers(ctx, &pb.Empty{})
	}
	return streamData(ctx, token, c.cfg.ContextTimeout, createStream)
}

func (c *Conn) GetUserByID(ctx context.Context, token string, id string) (*pb.User, error) {
	ctx, cancel := context.WithTimeout(ctx, c.cfg.ContextTimeout)
	defer cancel()
	errCh := make(chan error, 1)
	var user *pb.User
	go func() {
		client := pb.NewUserServiceClient(c.conn)
		c := metadata.AppendToOutgoingContext(ctx, "Authorization", token)
		res, err := client.GetUserByID(c, &pb.ID{Id: id})
		if err != nil {
			errCh <- fmt.Errorf("error getting user by ID: %w", err)
			return
		}
		user = res
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		return user, err
	case <-ctx.Done():
		return nil, fmt.Errorf("error getting user by ID: %w", ctx.Err())
	}
}


func (c *Conn) UpdateUser(ctx context.Context, token string, user *pb.User) (*pb.User, error) {
	client := pb.NewUserServiceClient(c.conn)
	ctx = metadata.AppendToOutgoingContext(ctx, "Authorization", token)
	updatedUser, err := client.EditUser(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("error updating user: %w", err)
	}
	return updatedUser, nil
}
