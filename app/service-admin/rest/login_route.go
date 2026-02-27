package rest

import (
	"net/http"
	"service-admin/web/pages/login"
)

func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Domain:   h.cfg.Domain,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Domain:   h.cfg.Domain,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Domain:   h.cfg.Domain,
	})
	errorMessage := r.URL.Query().Get("error")
	err := login.Login(h.cfg, errorMessage).Render(r.Context(), w)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *Handler) handleLoginPhone(w http.ResponseWriter, r *http.Request) {
	err := login.Phone(h.cfg).Render(r.Context(), w)
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error rendering phone page", err)
	}
}

func (h *Handler) handleLoginVerify(w http.ResponseWriter, r *http.Request) {
	session, err := r.Cookie("session_token")
	if err != nil {
		handleError(w, r, http.StatusUnauthorized, "Session cookie not found", err)
		return
	}
	claims, err := h.authService.ValidateSessionToken(session.Value)
	if err != nil {
		handleError(w, r, http.StatusUnauthorized, "Invalid session token", err)
		return
	}
	// last 4 digits of phone number
	mask := claims.Phone[len(claims.Phone)-4:]
	err = login.Verify(h.cfg, mask).Render(r.Context(), w)
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error rendering verify page", err)
	}
}
