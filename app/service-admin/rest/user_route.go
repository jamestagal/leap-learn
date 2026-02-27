package rest

import (
	"fmt"
	"log/slog"
	"net/http"
	"service-admin/auth"
	pb "service-admin/proto"
	"service-admin/web/components/toast"
	"service-admin/web/pages/users"
	"strconv"
)

func (h *Handler) handleUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	token, u := getAuth(h, w, r)
	if token == "" {
		return
	}

	if u.Access&auth.GetUsers == 0 {
		handleError(w, r, http.StatusForbidden, "User does not have access to view users", nil)
		return
	}


	if r.FormValue("_method") == "PUT" {
		if u.Access&auth.EditUser == 0 {
			handleError(w, r, http.StatusForbidden, "User does not have access to update users", nil)
			return
		}
		
		userID := r.FormValue("id")
		email := r.FormValue("email")
		phone := r.FormValue("phone")
		access := r.FormValue("access")
		avatar := r.FormValue("avatar")
		subscriptionID := r.FormValue("subscription_id")
		subscriptionEnd := r.FormValue("subscription_end")
		apiKey := r.FormValue("api_key")
		
		accessInt, err := strconv.ParseInt(access, 10, 64)
		if err != nil {
			handleError(w, r, http.StatusBadRequest, "Invalid access value", err)
			return
		}
		
		user := &pb.User{
			Id:              userID,
			Email:           email,
			Phone:           phone,
			Access:          accessInt,
			Avatar:          avatar,
			SubscriptionId:  subscriptionID,
			SubscriptionEnd: subscriptionEnd,
			ApiKey:          apiKey,
			Created:         "",
			Updated:         "",
			Sub:             "",
			SubscriptionActive: false,
		}
		
		_, err = h.conn.UpdateUser(ctx, token, user)
		if err != nil {
			handleError(w, r, http.StatusInternalServerError, "Error updating user", err)
			return
		}
		
		triggerPayload := fmt.Sprintf(`{"user-saved": {"id": "%s"}}`, userID)
		w.Header().Set("Hx-Trigger", triggerPayload)
		toast.SendToast(
			ctx,
			h.broker,
			u.ID.String(),
			toast.Data{Type: "success", Title: "User Updated", Message: "User has been updated successfully."},
		)
	}

	// Get all users
	allUsers, err := h.conn.GetAllUsers(ctx, token)
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error getting all users", err)
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=1")
	isHTMX := r.Header.Get("Hx-Request") == "true"
	err = users.UsersPage(h.cfg, users.Props{Users: allUsers}, isHTMX).Render(ctx, w)
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error rendering users page", err)
	}
}

func (h *Handler) handleCalculateAccess(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	token, u := getAuth(h, w, r)
	if token == "" {
		return
	}

	var err error
	_ = r.ParseForm()
	access := r.Form["access[]"]
	sum := 0
	for _, v := range access {
		i, err := strconv.Atoi(v)
		if err != nil {
			slog.Error("Error converting access to int", "access", v)
			continue
		}
		sum += i
	}
	err = h.broker.Notify(ctx, u.ID.String(), "user-access", strconv.Itoa(sum))
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error rendering user access", err)
		return
	}
}
