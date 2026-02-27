package note

import (
	"app/pkg"
	"context"
	"service-core/storage/query"

	"github.com/google/uuid"
)

type noteStore interface {
	CountNotes(ctx context.Context, userID uuid.UUID) (int64, error)
	SelectNotes(ctx context.Context, params query.SelectNotesParams) ([]query.Note, error)
	SelectNote(ctx context.Context, id uuid.UUID) (query.Note, error)
	InsertNote(ctx context.Context, params query.InsertNoteParams) (query.Note, error)
	UpdateNote(ctx context.Context, params query.UpdateNoteParams) (query.Note, error)
	DeleteNote(ctx context.Context, id uuid.UUID) error

	SelectUser(ctx context.Context, id uuid.UUID) (query.User, error)
}

type Service struct {
	noteStore noteStore
}

func NewService(
	noteStore noteStore,
) *Service {
	return &Service{
		noteStore: noteStore,
	}
}

type Note struct {
	Note query.Note `json:"note"`
	User query.User `json:"user"`
}
type Response struct {
	Count int64  `json:"count"`
	Notes []Note `json:"notes"`
}

func (s *Service) GetNotesByUserID(
	ctx context.Context,
	page int32,
	limit int32,
	userID uuid.UUID,
) (*Response, error) {
	errChan := make(chan error, 2)
	var count int64
	notesWithUsers := make([]Note, 0)
	go func() {
		c, err := s.noteStore.CountNotes(ctx, userID)
		if err != nil {
			errChan <- pkg.InternalError{Message: "Error counting notes", Err: err}
			return
		}
		count = c
		errChan <- nil
	}()
	go func() {
		params := query.SelectNotesParams{
			Limit:  limit,
			Offset: (page - 1) * limit,
			UserID: userID,
		}
		notes, err := s.noteStore.SelectNotes(ctx, params)
		if err != nil {
			errChan <- pkg.InternalError{Message: "Error selecting notes", Err: err}
			return
		}
		for _, note := range notes {
			user, err := s.noteStore.SelectUser(ctx, note.UserID)
			if err != nil {
				errChan <- pkg.InternalError{Message: "Error selecting user", Err: err}
				return
			}
			notesWithUsers = append(notesWithUsers, Note{
				Note: note,
				User: user,
			})
		}
		errChan <- nil
	}()

	for range 2 {
		err := <-errChan
		if err != nil {
			return nil, err
		}
	}

	return &Response{
		Count: count,
		Notes: notesWithUsers,
	}, nil
}

func (s *Service) GetNoteByID(
	ctx context.Context,
	id uuid.UUID,
) (*Note, error) {
	note, err := s.noteStore.SelectNote(ctx, id)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting note by ID", Err: err}
	}
	user, err := s.noteStore.SelectUser(ctx, note.UserID)
	if err != nil {
		return nil, pkg.NotFoundError{Message: "Error selecting user", Err: err}
	}
	return &Note{
		Note: note,
		User: user,
	}, nil
}

func (s *Service) CreateNote(
	ctx context.Context,
	userID uuid.UUID,
    title string,
    category string,
    content string,
) (*query.Note, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return nil, pkg.InternalError{Message: "Error generating note ID", Err: err}
	}

	params := query.InsertNoteParams{
		ID:       id,
		UserID:   userID,
		Title:    title,
		Category: category,
		Content:  content,
	}
	err = validate(&schema{
		title:    params.Title,
		category: params.Category,
		content:  params.Content,
	})
	if err != nil {
		return nil, err
	}
	note, err := s.noteStore.InsertNote(ctx, params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error inserting note", Err: err}
	}
	return &note, nil
}

func (s *Service) EditNote(
	ctx context.Context,
	id uuid.UUID,
    title string,
    category string,
    content string,
) (*query.Note, error) {
	params := query.UpdateNoteParams{
		ID:       id,
		Title:    title,
		Category: category,
		Content:  content,
	}
    err := validate(&schema{
		title:    params.Title,
		category: params.Category,
		content:  params.Content,
	})
	if err != nil {
		return nil, err
	}

	note, err := s.noteStore.UpdateNote(ctx, params)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error updating note", Err: err}
	}
	return &note, nil
}

func (s *Service) RemoveNote(
	ctx context.Context,
	id uuid.UUID,
) error {
    err := s.noteStore.DeleteNote(ctx, id)
	if err != nil {
		return pkg.InternalError{Message: "Error deleting note", Err: err}
	}
	return nil
}
