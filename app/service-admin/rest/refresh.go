package rest

import (
	"log/slog"
	"net/http"
	"service-admin/auth"
	pb "service-admin/proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

func getAuth(h *Handler, w http.ResponseWriter, r *http.Request) (string, *auth.AccessTokenClaims) {
	ctx := r.Context()
	isHTMX := r.Header.Get("Hx-Request") == "true"
	refreshToken, err := r.Cookie("refresh_token")
	if err != nil {
		redirect(w, r, isHTMX, h.cfg.Domain)
		return "", nil
	}
	accessToken, err := r.Cookie("access_token")
	if err != nil {
		accessToken = &http.Cookie{Value: ""}
	}

	u, err := h.authService.ValidateAccessToken(accessToken.Value)
	if err == nil {
		if u.Access&(auth.GetUsers|auth.EditUser) != (auth.GetUsers | auth.EditUser) {
			slog.Error("User is not an admin", "email", u.Email)
			return redirect(w, r, isHTMX, h.cfg.Domain)
		}
		return accessToken.Value, u
	}
	slog.Debug("Access token is invalid, refreshing tokens", "error", err)

	conn, err := grpc.NewClient(h.cfg.CoreURI, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		slog.Error("Error creating gRPC client", "error", err)
		return redirect(w, r, isHTMX, h.cfg.Domain)
	}
	client := pb.NewAuthServiceClient(conn)
	ctx = metadata.AppendToOutgoingContext(ctx, "access_token", accessToken.Value)
	ctx = metadata.AppendToOutgoingContext(ctx, "refresh_token", refreshToken.Value)
	resp, err := client.Refresh(ctx, &pb.Empty{})
	if err != nil {
		slog.Error("Error refreshing tokens", "error", err)
		return redirect(w, r, isHTMX, h.cfg.Domain)
	}

	newAccessToken := resp.GetAccessToken()
	newRefreshToken := resp.GetRefreshToken()
	// Max-Age for access token is 5 minutes, refresh token is 30 days
	w.Header().Add("Set-Cookie", "access_token="+newAccessToken+"; Max-Age=300; HttpOnly; Secure; SameSite=Strict; Path=/; Domain="+h.cfg.Domain)
	w.Header().Add("Set-Cookie", "refresh_token="+newRefreshToken+"; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict; Path=/; Domain="+h.cfg.Domain)

	u, err = h.authService.ValidateAccessToken(newAccessToken)
	if err != nil {
		slog.Error("Error validating access token", "error", err)
		return redirect(w, r, isHTMX, h.cfg.Domain)
	}
	if u.Access&(auth.GetUsers|auth.EditUser) != (auth.GetUsers | auth.EditUser) {
		slog.Error("User is not an admin", "email", u.Email)
		return redirect(w, r, isHTMX, h.cfg.Domain)
	}
	return newAccessToken, u
}

func redirect(w http.ResponseWriter, r *http.Request, isHTMX bool, domain string) (string, *auth.AccessTokenClaims) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Domain:   domain,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Domain:   domain,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Domain:   domain,
	})
	if r.URL.Path == "/sse" {
		return "", nil
	}
	if isHTMX {
		w.Header().Set("Hx-Redirect", "/login")
	} else {
		http.Redirect(w, r, "/login", http.StatusTemporaryRedirect)
	}
	return "", nil
}
