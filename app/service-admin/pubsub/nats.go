package pubsub

import (
	"fmt"
	"log/slog"
	"time"

	"github.com/nats-io/nats.go"
)

func ConnectNATS(url string) *nats.Conn {
	nc, err := nats.Connect(
		url,
		nats.Name("NATS Client"),
		nats.ReconnectWait(time.Second*2),
		nats.MaxReconnects(5), // Example: attempt 5 reconnects
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			slog.Warn("NATS connection lost", "error", err)
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			slog.Info("Reconnected to NATS server", "url", nc.ConnectedUrl())
		}),
		nats.ClosedHandler(func(nc *nats.Conn) {
			slog.Error("NATS connection closed", "error", nc.LastError())
			// Potentially trigger application shutdown or critical error state
		}),
	)
	if err != nil {
		panic(fmt.Errorf("failed to connect to NATS: %w", err))
	}
	return nc
}
