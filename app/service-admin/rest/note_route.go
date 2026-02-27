package rest

import (
	"fmt"
	"net/http"
	"service-admin/auth"
	"service-admin/web/components/toast"
	"service-admin/web/pages/notes"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (h *Handler) handleNotes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	token, user := getAuth(h, w, r)
	if token == "" {
		return
	}

	if user.Access&auth.GetNotes == 0 {
		handleError(w, r, http.StatusForbidden, "User does not have access to view users", nil)
		return
	}

	switch r.FormValue("_method") {
	case "POST":
		if user.Access&auth.CreateNote == 0 {
			handleError(w, r, http.StatusForbidden, "User does not have access to create notes", nil)
			return
		}
		title := r.FormValue("title")
		category := r.FormValue("category")
		content := r.FormValue("content")
		_, err := h.conn.CreateNote(ctx, token, title, category, content)
		st, ok := status.FromError(err)
		if ok && st.Code() == codes.InvalidArgument {
			err = h.broker.Notify(ctx, user.ID.String(), "error-0", st.Message())
			if err != nil {
				handleError(w, r, http.StatusInternalServerError, "Error sending toast", err)
				return
			}
			w.WriteHeader(http.StatusBadRequest)
			return
		} else if err != nil {
			handleError(w, r, http.StatusInternalServerError, "Error creating note", err)
			return
		}

		toast.SendToast(
			ctx,
			h.broker,
			user.ID.String(),
			toast.Data{Type: "success", Title: "Note Created", Message: "Your note has been created successfully."},
		)
	case "PUT":
		if user.Access&auth.EditNote == 0 {
			handleError(w, r, http.StatusForbidden, "User does not have access to create notes", nil)
			return
		}
		noteID := r.FormValue("id")
		title := r.FormValue("title")
		category := r.FormValue("category")
		content := r.FormValue("content")
		_, err := h.conn.EditNote(ctx, token, noteID, title, category, content)
		st, ok := status.FromError(err)
		if ok && st.Code() == codes.InvalidArgument {
			err = h.broker.Notify(ctx, user.ID.String(), "error-"+noteID, st.Message())
			if err != nil {
				handleError(w, r, http.StatusInternalServerError, "Error sending toast", err)
				return
			}
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if err != nil {
			handleError(w, r, http.StatusInternalServerError, "Error updating note", err)
			return
		}
		triggerPayload := fmt.Sprintf(`{"note-saved": {"id": "%s"}}`, noteID)
		w.Header().Set("Hx-Trigger", triggerPayload)
		toast.SendToast(
			ctx,
			h.broker,
			user.ID.String(),
			toast.Data{Type: "success", Title: "Note Updated", Message: "Your note has been updated successfully."},
		)
	case "DELETE":
		if user.Access&auth.RemoveNote == 0 {
			handleError(w, r, http.StatusForbidden, "User does not have access to create notes", nil)
			return
		}
		noteID := r.FormValue("id")
		err := h.conn.RemoveNote(ctx, token, noteID)
		if err != nil {
			handleError(w, r, http.StatusInternalServerError, "Error deleting note", err)
			return
		}
		toast.SendToast(
			ctx,
			h.broker,
			user.ID.String(),
			toast.Data{Type: "info", Title: "Note Deleted", Message: "Your note has been deleted successfully."},
		)
	}

	allNotes, err := h.conn.GetAllNotes(ctx, token)
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error getting notes", err)
		return
	}
	// 1 sec cache
	w.Header().Set("Cache-Control", "private, max-age=1")
	isHTMX := r.Header.Get("Hx-Request") == "true"
	err = notes.NotesPage(h.cfg, allNotes, "", isHTMX).Render(ctx, w)
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error rendering notes page", err)
	}
}
