package rest

import (
	"app/pkg"
	"app/pkg/auth"
	"errors"
	"net/http"
	"strconv"

	"github.com/google/uuid"
)

func (h *Handler) handleNotesCollection(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		accessToken := extractAccessToken(r)

		user, err := h.authService.Auth(accessToken, auth.GetNotes)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		pageStr := r.URL.Query().Get("page")
		limitStr := r.URL.Query().Get("limit")
		page, e1 := strconv.ParseInt(pageStr, 10, 32)
		limit, e2 := strconv.ParseInt(limitStr, 10, 32)

		if e1 != nil || e2 != nil {
			writeResponse(
				h.cfg,
				w,
				r,
				nil,
				pkg.InternalError{Message: "Error converting page and limit to int", Err: errors.New("error converting page and limit to int")},
			)
			return
		}

		notes, err := h.noteService.GetNotesByUserID(r.Context(), int32(page), int32(limit), user.ID)
		writeResponse(h.cfg, w, r, notes, err)
		return

	case http.MethodPost:
		accessToken := extractAccessToken(r)

		user, err := h.authService.Auth(accessToken, auth.CreateNote)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		title := r.FormValue("title")
		category := r.FormValue("category")
		content := r.FormValue("content")

		response, err := h.noteService.CreateNote(r.Context(), user.ID, title, category, content)
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

func (h *Handler) handleNoteResource(w http.ResponseWriter, r *http.Request) {
	noteIDStr := r.PathValue("id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.InternalError{Message: "Error parsing note ID", Err: err})
		return
	}

	token := extractAccessToken(r)

	switch r.Method {
	case http.MethodGet:
		_, err := h.authService.Auth(token, auth.GetNotes)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		response, err := h.noteService.GetNoteByID(r.Context(), noteID)
		writeResponse(h.cfg, w, r, response, err)
		return

	case http.MethodPut:
		_, err := h.authService.Auth(token, auth.EditNote)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		title := r.FormValue("title")
		category := r.FormValue("category")
		content := r.FormValue("content")

		response, err := h.noteService.EditNote(r.Context(), noteID, title, category, content)
		writeResponse(h.cfg, w, r, response, err)
		return

	case http.MethodDelete:
		_, err := h.authService.Auth(token, auth.RemoveNote)
		if err != nil {
			writeResponse(h.cfg, w, r, nil, err)
			return
		}

		err = h.noteService.RemoveNote(r.Context(), noteID)
		writeResponse(h.cfg, w, r, nil, err) 
		return

	case http.MethodOptions:
		writeResponse(h.cfg, w, r, nil, nil)
		return

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
}
