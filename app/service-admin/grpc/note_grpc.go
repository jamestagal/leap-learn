package grpc

import (
	"context"
	"fmt"

	pb "service-admin/proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

func (c *Conn) GetAllNotes(ctx context.Context, token string) ([]*pb.Note, error) {
	createStream := func(ctx context.Context) (grpc.ServerStreamingClient[pb.Note], error) {
		client := pb.NewNoteServiceClient(c.conn)
		return client.GetAllNotes(ctx, &pb.Empty{})
	}
	return streamData(ctx, token, c.cfg.ContextTimeout, createStream)
}

func (c *Conn) CreateNote(ctx context.Context, token string, title, category, content string) (*pb.Note, error) {
	ctx, cancel := context.WithTimeout(ctx, c.cfg.ContextTimeout)
	defer cancel()
	errCh := make(chan error, 1)
	var note *pb.Note
	go func() {
		client := pb.NewNoteServiceClient(c.conn)
		c := metadata.AppendToOutgoingContext(ctx, "Authorization", token)
		res, err := client.CreateNote(c, &pb.NoteRequest{
			Title:    title,
			Category: category,
			Content:  content,
			Id:       "",
		})
		if err != nil {
			errCh <- err
			return
		}
		note = res
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		return note, err
	case <-ctx.Done():
		return nil, fmt.Errorf("error creating note: %w", ctx.Err())
	}
}

func (c *Conn) EditNote(ctx context.Context, token string, noteID, title, category, content string) (*pb.Note, error) {
	ctx, cancel := context.WithTimeout(ctx, c.cfg.ContextTimeout)
	defer cancel()
	errCh := make(chan error, 1)
	var note *pb.Note
	go func() {
		client := pb.NewNoteServiceClient(c.conn)
		c := metadata.AppendToOutgoingContext(ctx, "Authorization", token)
		res, err := client.EditNote(c, &pb.NoteRequest{
			Id:       noteID,
			Title:    title,
			Category: category,
			Content:  content,
		})
		if err != nil {
			errCh <- err
			return
		}
		note = res
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		return note, err
	case <-ctx.Done():
		return nil, fmt.Errorf("error editing note: %w", ctx.Err())
	}
}

func (c *Conn) RemoveNote(ctx context.Context, token string, noteID string) error {
	ctx, cancel := context.WithTimeout(ctx, c.cfg.ContextTimeout)
	defer cancel()
	errCh := make(chan error, 1)
	go func() {
		client := pb.NewNoteServiceClient(c.conn)
		c := metadata.AppendToOutgoingContext(ctx, "Authorization", token)
		_, err := client.RemoveNote(c, &pb.ID{
			Id: noteID,
		})
		if err != nil {
			errCh <- fmt.Errorf("error removing note: %w", err)
			return
		}
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		return fmt.Errorf("error removing note: %w", ctx.Err())
	}
}
