package toast

import (
	"app/pkg/str"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"service-admin/pubsub"
)

type Type string
const (
	Success Type = "success"
	Error   Type = "error"
	Info    Type = "info"
)

type Data struct {
	Type    Type
	Title   string
	Message string
}

func SendToast(ctx context.Context, broker *pubsub.EventBroker, userID string, data Data) {
	id, _ := str.GenerateRandomHexString()
	toastStr, err := json.Marshal(map[string]any{
		"id":      id,
		"type":    data.Type,
		"title":   data.Title,
		"message": data.Message,
	})
	if err != nil {
		panic(fmt.Sprintf("Error marshalling toast data: %v", err))
	}
	err = broker.Notify(ctx, userID, "sse-toast", string(toastStr))
	if err != nil {
		slog.Error("Error sending toast", "error", err)
	}
}
