package rest

import (
	"net/http"
	"service-admin/web/pages/home"
	"time"
)

func (h *Handler) handleHome(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	token, _ := getAuth(h, w, r)
	if token == "" {
		return
	}

	w.Header().Set("Cache-Control", "private, max-age=1")
	isHTMX := r.Header.Get("Hx-Request") == "true"
	err := home.HomePage(h.cfg, isHTMX).Render(ctx, w)
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error rendering home page", err)
	}
}
func (h *Handler) handleBroadcast(w http.ResponseWriter, r *http.Request) {
	var chuckNorrisJokes = []string{
		"Chuck Norris can divide by zero.",
		"Chuck Norris can slam a revolving door.",
		"Chuck Norris can unscramble an egg.",
		"Chuck Norris can hear sign language.",
		"Chuck Norris can tie his shoes with his feet.",
		"Chuck Norris can win a game of Connect Four in only three moves.",
		"Chuck Norris can play the violin with a piano.",
		"Chuck Norris can make a Happy Meal cry.",
		"Chuck Norris can make a snowman out of rain and dirt.",
		"Chuck Norris can make a fire by rubbing two ice cubes together.",
		"Chuck Norris can make a snow angel in the Sahara Desert.",
		"Chuck Norris can make a snowball out of rain.",
	}
	randomJoke := chuckNorrisJokes[time.Now().UnixNano()%int64(len(chuckNorrisJokes))]
	err := h.broker.Broadcast(r.Context(), "sse-chuck", randomJoke)
	if err != nil {
		handleError(w, r, http.StatusInternalServerError, "Error broadcasting message", err)
		return
	}
	w.WriteHeader(http.StatusCreated)
}
