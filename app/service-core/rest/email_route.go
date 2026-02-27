package rest

import (
	"app/pkg"
	"app/pkg/auth"
	"log/slog"
	"net/http"

	"github.com/google/uuid"
)

func (h *Handler) handleEmails(w http.ResponseWriter, r *http.Request) {
	token := extractAccessToken(r)

	switch r.Method {
	case http.MethodGet:
		user, err := h.authService.Auth(token, auth.GetEmails)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		emails, err := h.emailService.GetEmails(r.Context(), user.ID)
		writeResponse(h.cfg, w, r, emails, err)
		return

	case http.MethodPost:
		user, err := h.authService.Auth(token, auth.SendEmail)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		emailTo := r.FormValue("email_to")
		emailSubject := r.FormValue("email_subject")
		emailBody := r.FormValue("email_body")
		attachmentIDs := r.Form["attachment_ids"]
		slog.Debug("Received email request", "sending_user_id", user.ID, "email_to", emailTo, "email_subject", emailSubject, "attachment_ids", attachmentIDs)

		var parsedAttachmentIDs []uuid.UUID
		if len(attachmentIDs) > 0 {
			parsedAttachmentIDs = make([]uuid.UUID, 0, len(attachmentIDs))
			for _, idStr := range attachmentIDs {
				parsedID, err := uuid.Parse(idStr)
				if err != nil {
					writeResponse(h.cfg, w, r, nil, pkg.BadRequestError{Message: "Invalid attachment ID format", Err: err})
					return
				}
				parsedAttachmentIDs = append(parsedAttachmentIDs, parsedID)
			}
		}

		response, err := h.emailService.SendEmail(r.Context(), user.ID, emailTo, emailSubject, emailBody, parsedAttachmentIDs)
		writeResponse(h.cfg, w, r, response, err)
		return

	case http.MethodOptions:
		writeResponse(h.cfg, w, r, nil, nil)
		return

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
}
