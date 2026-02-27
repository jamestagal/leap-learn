package user

import (
	"app/pkg"
	"context"
	"service-core/config"
	"service-core/storage/query"
	"time"

	pb "service-core/proto"

	"github.com/google/uuid"
)

type store interface {
	SelectUsers(ctx context.Context) ([]query.User, error)
	SelectUser(ctx context.Context, id uuid.UUID) (query.User, error)
	UpdateUserAccess(ctx context.Context, params query.UpdateUserAccessParams) (query.User, error)
	UpdateUser(ctx context.Context, params query.UpdateUserParams) (query.User, error)
}

type Service struct {
	cfg         *config.Config
	store   store
}

func NewService(
	cfg *config.Config,
	store store,
) *Service {
	return &Service{
		cfg:         cfg,
		store:   store,
	}
}

func (s *Service) GetAllUsers(ctx context.Context, stream pb.UserService_GetAllUsersServer) error {
	users, err := s.store.SelectUsers(ctx)
	if err != nil {
		return pkg.NotFoundError{Message: "Error selecting users", Err: err}
	}
	for _, user := range users {
		res := &pb.User{
			Id:                 user.ID.String(),
			Updated:            user.Updated.Format(time.RFC3339),
			Created:            user.Created.Format(time.RFC3339),
			Email:              user.Email,
			Phone:              user.Phone,
			Access:             user.Access,
			Sub:                user.Sub,
			Avatar:             user.Avatar,
			SubscriptionId:     user.SubscriptionID,
			SubscriptionEnd:    user.SubscriptionEnd.Format(time.RFC3339),
			SubscriptionActive: false,
			ApiKey:             user.ApiKey,
		}
		err := stream.Send(res)
		if err != nil {
			return pkg.InternalError{Message: "Error sending user", Err: err}
		}
	}
	return nil
}

func (s *Service) GetUserByID(ctx context.Context, id string) (*pb.User, error) {
	uuid, err := uuid.Parse(id)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error parsing UUID", Err: err}
	}
	user, err := s.store.SelectUser(ctx, uuid)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting user by ID", Err: err}
	}
	return &pb.User{
		Id:                 user.ID.String(),
		Created:            user.Created.Format(time.RFC3339),
		Updated:            user.Updated.Format(time.RFC3339),
		Email:              user.Email,
		Phone:              user.Phone,
		Access:             user.Access,
		Sub:                user.Sub,
		Avatar:             user.Avatar,
		SubscriptionId:     user.SubscriptionID,
		SubscriptionEnd:    user.SubscriptionEnd.Format(time.RFC3339),
		SubscriptionActive: false,
		ApiKey:             user.ApiKey,
	}, nil
}


func (s *Service) EditUser(ctx context.Context, userPb *pb.User) (*pb.User, error) {
	uuid, err := uuid.Parse(userPb.GetId())
	if err != nil {
		return nil, pkg.InternalError{Message: "Error parsing UUID", Err: err}
	}
	
	var subscriptionEnd time.Time
	if userPb.GetSubscriptionEnd() != "" {
		subscriptionEndStr := userPb.GetSubscriptionEnd()
		var err error
		
		subscriptionEnd, err = time.Parse("2006-01-02T15:04", subscriptionEndStr)
		if err != nil {
			// Fallback to RFC3339 format
			subscriptionEnd, err = time.Parse(time.RFC3339, subscriptionEndStr)
			if err != nil {
				return nil, pkg.InternalError{Message: "Error parsing subscription end date", Err: err}
			}
		}
	} else {
		subscriptionEnd = time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	}
	
	params := query.UpdateUserParams{
		Email:           userPb.GetEmail(),
		Phone:           userPb.GetPhone(),
		Access:          userPb.GetAccess(),
		Avatar:          userPb.GetAvatar(),
		SubscriptionID:  userPb.GetSubscriptionId(),
		SubscriptionEnd: subscriptionEnd,
		ApiKey:          userPb.GetApiKey(),
		ID:              uuid,
	}
	
	user, err := s.store.UpdateUser(ctx, params)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error updating user", Err: err}
	}
	
	return &pb.User{
		Id:                 user.ID.String(),
		Created:            user.Created.Format(time.RFC3339),
		Updated:            user.Updated.Format(time.RFC3339),
		Email:              user.Email,
		Phone:              user.Phone,
		Access:             user.Access,
		Sub:                user.Sub,
		Avatar:             user.Avatar,
		SubscriptionId:     user.SubscriptionID,
		SubscriptionEnd:    user.SubscriptionEnd.Format(time.RFC3339),
		SubscriptionActive: false,
		ApiKey:             user.ApiKey,
	}, nil
}
