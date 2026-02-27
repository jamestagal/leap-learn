package rest

import (
	"app/pkg"
	"errors"
	"net/http"
	"service-core/domain/login"
	"strings"
)

// isSecureCookie returns true if cookies should have Secure flag set.
// Secure cookies only work with HTTPS, so we disable it for localhost development.
func isSecureCookie(domain string) bool {
	return !strings.HasPrefix(domain, "localhost")
}

func (h *Handler) handleRefresh(w http.ResponseWriter, r *http.Request) {
	refreshToken, err := r.Cookie("refresh_token")
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: err})
		return
	}
	accessToken, err := r.Cookie("access_token")
	if err != nil {
		accessToken = &http.Cookie{Value: ""}
	}
	response, err := h.loginService.Refresh(r.Context(), accessToken.Value, refreshToken.Value)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Path:     "/",
		Name:     "access_token",
		Value:    response.AccessToken,
		Secure:   isSecureCookie(h.cfg.Domain),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Domain:   h.cfg.Domain,
		MaxAge:   int(h.cfg.AccessTokenExp.Seconds()),
	})
	http.SetCookie(w, &http.Cookie{
		Path:     "/",
		Name:     "refresh_token",
		Value:    response.RefreshToken,
		Secure:   isSecureCookie(h.cfg.Domain),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Domain:   h.cfg.Domain,
		MaxAge:   int(h.cfg.RefreshTokenExp.Seconds()),
	})
	writeResponse(h.cfg, w, r, response, nil)
}

func (h *Handler) handleLogout(w http.ResponseWriter, r *http.Request) {
	returnURL := r.FormValue("return_url")
	// Validate return URL starts with allowed base URLs (allows paths)
	if !strings.HasPrefix(returnURL, h.cfg.AdminURL) && !strings.HasPrefix(returnURL, h.cfg.ClientURL) {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("invalid origin")})
		return
	}
	http.SetCookie(w, &http.Cookie{
		Path:     "/",
		Name:     "access_token",
		Value:    "",
		MaxAge:   -1,
		Secure:   isSecureCookie(h.cfg.Domain),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Domain:   h.cfg.Domain,
	})
	http.SetCookie(w, &http.Cookie{
		Path:     "/",
		Name:     "refresh_token",
		Value:    "",
		MaxAge:   -1,
		Secure:   isSecureCookie(h.cfg.Domain),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Domain:   h.cfg.Domain,
	})
	http.SetCookie(w, &http.Cookie{
		Path:     "/",
		Name:     "session_token",
		Value:    "",
		MaxAge:   -1,
		Secure:   isSecureCookie(h.cfg.Domain),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Domain:   h.cfg.Domain,
	})
	http.Redirect(w, r, returnURL, http.StatusFound)
}

func (h *Handler) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		writeResponse(h.cfg, w, r, nil, nil)
		return
	}
	p := r.FormValue("provider")
	userEmail := r.FormValue("email")
	returnURL := r.FormValue("return_url")

	response, err := h.loginService.Login(r.Context(), userEmail, returnURL, login.Provider(p))
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	http.Redirect(w, r, response.URL, http.StatusFound)
}

func (h *Handler) handleLoginCallback(w http.ResponseWriter, r *http.Request) {
	p := r.PathValue("provider")
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	userEmail := r.URL.Query().Get("email")
	response, err := h.loginService.LoginCallback(r.Context(), state, code, userEmail, login.Provider(p))
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	if response.SessionToken != "" {
		// 2FA flow
		http.SetCookie(w, &http.Cookie{
			Name:     "session_token",
			Path:     "/",
			Value:    response.SessionToken,
			Secure:   isSecureCookie(h.cfg.Domain),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Domain:   h.cfg.Domain,
			MaxAge:   int(h.cfg.AccessTokenExp.Seconds()),
		})
		if response.HasPhone {
			http.Redirect(w, r, response.ReturnURL+"/login/verify", http.StatusFound)
		} else {
			http.Redirect(w, r, response.ReturnURL+"/login/phone", http.StatusFound)
		}
	} else {
		// Normal flow
		http.SetCookie(w, &http.Cookie{
			Path:     "/",
			Name:     "access_token",
			Value:    response.AccessToken,
			Secure:   isSecureCookie(h.cfg.Domain),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Domain:   h.cfg.Domain,
			MaxAge:   int(h.cfg.AccessTokenExp.Seconds()),
		})
		http.SetCookie(w, &http.Cookie{
			Path:     "/",
			Name:     "refresh_token",
			Value:    response.RefreshToken,
			Secure:   isSecureCookie(h.cfg.Domain),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Domain:   h.cfg.Domain,
			MaxAge:   int(h.cfg.RefreshTokenExp.Seconds()),
		})
		http.Redirect(w, r, response.ReturnURL, http.StatusFound)
	}
}

func (h *Handler) handleLoginPhone(w http.ResponseWriter, r *http.Request) {
	returnURL := r.FormValue("return_url")
	sessionToken, err := r.Cookie("session_token")
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: err})
		return
	}
	claims, err := h.authService.ValidateSessionToken(sessionToken.Value)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: err})
		return
	}
	if claims.Phone != "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("phone already exists")})
		return
	}

	phone := r.FormValue("phone")
	s, err := h.loginService.LoginPhone(r.Context(), claims.ID, phone)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Path:     "/",
		Value:    s,
		Secure:   isSecureCookie(h.cfg.Domain),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Domain:   h.cfg.Domain,
		MaxAge:   int(h.cfg.AccessTokenExp.Seconds()),
	})
	http.Redirect(w, r, returnURL+"/login/verify", http.StatusFound)
}

func (h *Handler) handleLoginVerify(w http.ResponseWriter, r *http.Request) {
	returnURL := r.FormValue("return_url")
	sessionToken, err := r.Cookie("session_token")
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: err})
		return
	}
	claims, err := h.authService.ValidateSessionToken(sessionToken.Value)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: err})
		return
	}
	phone := claims.Phone
	if phone == "" {
		writeResponse(h.cfg, w, r, nil, pkg.UnauthorizedError{Err: errors.New("phone not found")})
		return
	}

	code := r.FormValue("code")
	tokens, err := h.loginService.LoginVerify(r.Context(), claims.ID, phone, code)
	if err != nil {
		writeResponse(h.cfg, w, r, nil, err)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Path:     "/",
		Name:     "access_token",
		Value:    tokens.AccessToken,
		Secure:   isSecureCookie(h.cfg.Domain),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Domain:   h.cfg.Domain,
		MaxAge:   int(h.cfg.AccessTokenExp.Seconds()),
	})
	http.SetCookie(w, &http.Cookie{
		Path:     "/",
		Name:     "refresh_token",
		Value:    tokens.RefreshToken,
		Secure:   isSecureCookie(h.cfg.Domain),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Domain:   h.cfg.Domain,
		MaxAge:   int(h.cfg.RefreshTokenExp.Seconds()),
	})
	http.Redirect(w, r, returnURL, http.StatusFound)
}
