package grpc

import (
	"app/pkg/auth"
	"context"
	pb "service-core/proto"

	"github.com/google/uuid"
)

func (s *noteServer) GetAllNotes(_ *pb.Empty, stream pb.NoteService_GetAllNotesServer) error {
	ctx := stream.Context()
	token := getToken(ctx)
	user, err := s.handler.authService.Auth(token, auth.GetNotes)
	if err != nil {
		return writeResponse(err)
	}
	page := int32(1)
	limit := int32(100)
	r, err := s.handler.noteService.GetNotesByUserID(ctx, page, limit, user.ID)
	if err != nil {
		return writeResponse(err)
	}
	for _, note := range r.Notes {
		note := &pb.Note{
			Id:       note.Note.ID.String(),
			Created:  note.Note.Created.Format("2006-01-02 15:04:05"),
			Updated:  note.Note.Updated.Format("2006-01-02 15:04:05"),
			UserId:   note.User.ID.String(),
			Title:    note.Note.Title,
			Category: note.Note.Category,
			Content:  note.Note.Content,
		}
		err := stream.Send(note)
		if err != nil {
			return writeResponse(err)
		}
	}
	return nil
}

func (s *noteServer) GetNoteByID(ctx context.Context, in *pb.ID) (*pb.Note, error) {
	token := getToken(ctx)
	_, err := s.handler.authService.Auth(token, auth.GetNotes)
	if err != nil {
		return nil, writeResponse(err)
	}
	id, err := uuid.Parse(in.GetId())
	if err != nil {
		return nil, writeResponse(err)
	}
	note, err := s.handler.noteService.GetNoteByID(ctx, id)
	if err != nil {
		return nil, writeResponse(err)
	}
	return &pb.Note{
		Id:       note.Note.ID.String(),
		Created:  note.Note.Created.Format("2006-01-02 15:04:05"),
		Updated:  note.Note.Updated.Format("2006-01-02 15:04:05"),
		UserId:   note.User.ID.String(),
		Title:    note.Note.Title,
		Category: note.Note.Category,
		Content:  note.Note.Content,
	}, nil
}

func (s *noteServer) CreateNote(ctx context.Context, in *pb.NoteRequest) (*pb.Note, error) {
	token := getToken(ctx)
	user, err := s.handler.authService.Auth(token, auth.CreateNote)
	if err != nil {
		return nil, writeResponse(err)
	}
	note, err := s.handler.noteService.CreateNote(ctx, user.ID, in.GetTitle(), in.GetCategory(), in.GetContent())
	if err != nil {
		return nil, writeResponse(err)
	}
	return &pb.Note{
		Id:       note.ID.String(),
		Created:  note.Created.Format("2006-01-02 15:04:05"),
		Updated:  note.Updated.Format("2006-01-02 15:04:05"),
		UserId:   user.ID.String(),
		Title:    note.Title,
		Category: note.Category,
		Content:  note.Content,
	}, nil
}

func (s *noteServer) EditNote(ctx context.Context, in *pb.NoteRequest) (*pb.Note, error) {
	token := getToken(ctx)
	user, err := s.handler.authService.Auth(token, auth.EditNote)
	if err != nil {
		return nil, writeResponse(err)
	}
	id, err := uuid.Parse(in.GetId())
	if err != nil {
		return nil, writeResponse(err)
	}
	note, err := s.handler.noteService.EditNote(ctx, id, in.GetTitle(), in.GetCategory(), in.GetContent())
	if err != nil {
		return nil, writeResponse(err)
	}
	return &pb.Note{
		Id:       note.ID.String(),
		Created:  note.Created.Format("2006-01-02 15:04:05"),
		Updated:  note.Updated.Format("2006-01-02 15:04:05"),
		UserId:   user.ID.String(),
		Title:    note.Title,
		Category: note.Category,
		Content:  note.Content,
	}, nil
}

func (s *noteServer) RemoveNote(ctx context.Context, in *pb.ID) (*pb.Empty, error) {
	token := getToken(ctx)
	_, err := s.handler.authService.Auth(token, auth.RemoveNote)
	if err != nil {
		return nil, writeResponse(err)
	}
	id, err := uuid.Parse(in.GetId())
	if err != nil {
		return nil, writeResponse(err)
	}
	err = s.handler.noteService.RemoveNote(ctx, id)
	if err != nil {
		return nil, writeResponse(err)
	}
	return &pb.Empty{}, nil
}
