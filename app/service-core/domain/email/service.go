package email

import (
	"app/pkg"
	"context"
	"service-core/config"
	"service-core/storage/query"

	"github.com/google/uuid"
)

type store interface {
	SelectEmails(ctx context.Context, userID uuid.UUID) ([]query.Email, error)
	SelectEmailAttachments(ctx context.Context, emailID uuid.UUID) ([]query.EmailAttachment, error)
	InsertEmail(ctx context.Context, params query.InsertEmailParams) (query.Email, error)
	InsertEmailAttachment(ctx context.Context, params query.InsertEmailAttachmentParams) (query.EmailAttachment, error)
}

type provider interface {
	Send(ctx context.Context, email Email) error
	SendTemplate(ctx context.Context, templateID string, to string, data map[string]any) error
}

type fileService interface {
	DownloadFile(ctx context.Context, fileID uuid.UUID) (*query.File, []byte, error)
}

type Service struct {
	cfg         *config.Config
	store       store
	provider    provider
	fileService fileService
}

func NewService(
	cfg *config.Config,
	store store,
	provider provider,
	fileService fileService,
) *Service {
	return &Service{
		cfg:         cfg,
		store:       store,
		provider:    provider,
		fileService: fileService,
	}
}

type Response struct {
	Email       query.Email             `json:"email"`
	Attachments []query.EmailAttachment `json:"attachments"`
}

func (s *Service) GetEmails(
	ctx context.Context,
	userID uuid.UUID,
) ([]Response, error) {
	empty := make([]Response, 0)

	emails, err := s.store.SelectEmails(ctx, userID)
	if err != nil {
		return nil, pkg.InternalError{Message: "Error selecting emails", Err: err}
	}
	if len(emails) == 0 {
		return empty, nil
	}

	emailResponses := make([]Response, 0, len(emails))
	for _, email := range emails {
		attachments, err := s.store.SelectEmailAttachments(ctx, email.ID)
		if err != nil {
			return nil, pkg.InternalError{Message: "Error selecting email attachments", Err: err}
		}
		if len(attachments) == 0 {
			attachments = make([]query.EmailAttachment, 0)
		}
		emailResponses = append(emailResponses, Response{
			Email:       email,
			Attachments: attachments,
		})
	}
	return emailResponses, nil
}

func (s *Service) SendEmail(
	ctx context.Context,
	userID uuid.UUID,
	emailTo string,
	emailSubject string,
	emailBody string,
	attachmentsIDs []uuid.UUID,
) (*query.Email, error) {
	ctx, cancel := context.WithTimeout(ctx, s.cfg.ContextTimeout)
	defer cancel()

	id, err := uuid.NewV7()
	if err != nil {
		return nil, pkg.InternalError{Message: "Error generating email ID", Err: err}
	}

	// If we habe attachments, we need to download them first
	attachments := make([]Attachment, 0, len(attachmentsIDs))
	if len(attachmentsIDs) > 0 {
		for _, attachmentID := range attachmentsIDs {
			file, data, err := s.fileService.DownloadFile(ctx, attachmentID)
			if err != nil {
				return nil, pkg.InternalError{Message: "Error downloading file", Err: err}
			}
			if file == nil {
				return nil, pkg.InternalError{Message: "File not found", Err: nil}
			}
			if data == nil {
				return nil, pkg.InternalError{Message: "File data is empty", Err: nil}
			}
			attachment := Attachment{
				Filename:    file.FileName,
				ContentType: file.ContentType,
				Content:     data,
			}
			attachments = append(attachments, attachment)
		}
	}

	params := query.InsertEmailParams{
		ID:           id,
		UserID:       userID,
		EmailTo:      emailTo,
		EmailFrom:    s.cfg.EmailFrom,
		EmailSubject: emailSubject,
		EmailBody:    emailBody,
	}
	err = validate(params)
	if err != nil {
		return nil, err
	}

	errorChan := make(chan error, 1)
	go func() {
		email := Email{
			EmailTo:          params.EmailTo,
			EmailSubject:     params.EmailSubject,
			EmailBody:        params.EmailBody,
			EmailAttachments: attachments,
		}
		errorChan <- s.provider.Send(ctx, email)
	}()

	for {
		select {
		case <-ctx.Done():
			return nil, pkg.InternalError{Message: "Timeout sending email", Err: ctx.Err()}
		case err := <-errorChan:
			if err != nil {
				return nil, pkg.InternalError{Message: "Error sending email", Err: err}
			}
			email, err := s.store.InsertEmail(ctx, params)
			if err != nil {
				return nil, pkg.InternalError{Message: "Error inserting email", Err: err}
			}
			for _, attachment := range attachments {
				id, err := uuid.NewV7()
				if err != nil {
					return nil, pkg.InternalError{Message: "Error generating attachment ID", Err: err}
				}
				attachmentParams := query.InsertEmailAttachmentParams{
					ID:          id,
					EmailID:     email.ID,
					FileName:    attachment.Filename,
					ContentType: attachment.ContentType,
				}
				_, err = s.store.InsertEmailAttachment(ctx, attachmentParams)
				if err != nil {
					return nil, pkg.InternalError{Message: "Error inserting email attachment", Err: err}
				}
			}
			return &email, nil
		}
	}
}

func (s *Service) SendTemplateEmail(
	ctx context.Context,
	templateID string,
	to string,
	data map[string]any,
) error {
	ctx, cancel := context.WithTimeout(ctx, s.cfg.ContextTimeout)
	defer cancel()

	errorChan := make(chan error, 1)
	go func() {
		errorChan <- s.provider.SendTemplate(ctx, templateID, to, data)
	}()

	for {
		select {
		case <-ctx.Done():
			return pkg.InternalError{Message: "Timeout sending email", Err: ctx.Err()}
		case err := <-errorChan:
			if err != nil {
				return pkg.InternalError{Message: "Error sending email", Err: err}
			}
			return nil
		}
	}
}
