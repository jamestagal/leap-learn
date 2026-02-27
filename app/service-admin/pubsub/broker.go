package pubsub

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
)

const (
	maxClientChanBuffer = 100 // Max messages buffered per client
)

type Client struct {
	UserID string
	Ch     chan string
}

type sseMessage struct {
	Type   string `json:"type"` // "broadcast" or "notification"
	UserID string `json:"user_id,omitempty"`
	Event  string `json:"event"`
	Data   string `json:"data"`
}

type EventBroker struct {
	clients  map[*Client]bool
	mut      sync.RWMutex
	natsConn *nats.Conn         // NATS connection
	natsSub  *nats.Subscription // NATS subscription for this broker instance
}

func NewEventBroker(nc *nats.Conn, natsSubject string) (*EventBroker, error) {
	if nc == nil || !nc.IsConnected() {
		return nil, errors.New("NATS connection is nil or not connected")
	}
	broker := &EventBroker{
		clients:  make(map[*Client]bool),
		mut:      sync.RWMutex{},
		natsConn: nc,
		natsSub:  nil,
	}

	var err error
	broker.natsSub, err = nc.Subscribe(natsSubject, broker.handleNATSMessage)
	if err != nil {
		return nil, fmt.Errorf("error subscribing to NATS subject: %w", err)
	}

	err = nc.Flush()
	if err != nil {
		err := broker.natsSub.Unsubscribe()
		if err != nil {
			slog.Error("error unsubscribing from NATS subject", "error", err)
		}
		return nil, fmt.Errorf("error flushing NATS connection: %w", err)
	}
	return broker, nil
}

func (broker *EventBroker) handleNATSMessage(msg *nats.Msg) {
	var sseMsg sseMessage
	err := json.Unmarshal(msg.Data, &sseMsg)
	if err != nil {
		slog.Error("error unmarshalling NATS message", "error", err)
		return
	}
	slog.Debug("Received NATS message", "message", sseMsg)

	sseFormattedMessage := fmt.Sprintf("event: %s\ndata: %s\n\n", sseMsg.Event, sseMsg.Data)

	// Lock the client list for reading/modification
	broker.mut.Lock()
	defer broker.mut.Unlock()

	switch sseMsg.Type {
	case "broadcast":
		for client := range broker.clients {
			select {
			case client.Ch <- sseFormattedMessage:
			default:
				slog.Warn("Client channel is full/closed, removing client", "user_id", client.UserID)
				close(client.Ch)
				delete(broker.clients, client)
			}
		}
	case "notification":
		if sseMsg.UserID == "" {
			slog.Error("Notification message missing user ID", "message", sseMsg)
			return
		}
		for client := range broker.clients {
			if client.UserID == sseMsg.UserID {
				select {
				case client.Ch <- sseFormattedMessage:
				default:
					slog.Warn("Client channel is full/closed, removing client", "user_id", client.UserID)
					close(client.Ch)
					delete(broker.clients, client)
				}
			}
		}
	default:
		slog.Error("Unknown message type", "type", sseMsg.Type)
	}
}

func (broker *EventBroker) Subscribe(userID string) *Client {
	broker.mut.Lock()
	defer broker.mut.Unlock()

	client := &Client{
		UserID: userID,
		Ch:     make(chan string, maxClientChanBuffer),
	}
	broker.clients[client] = true

	slog.Debug("Client subscribed", "user_id", userID)
	return client
}

func (broker *EventBroker) Unsubscribe(client *Client) {
	broker.mut.Lock()
	defer broker.mut.Unlock()

	if _, ok := broker.clients[client]; ok {
		close(client.Ch)
		delete(broker.clients, client)
	}

	slog.Debug("Client unsubscribed", "user_id", client.UserID)
}

func (broker *EventBroker) publish(ctx context.Context, natsSubject string, msg sseMessage) error {
	if broker.natsConn == nil || !broker.natsConn.IsConnected() {
		return errors.New("cannot publish, NATS connection is not valid")
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("error marshalling message: %w", err)
	}

	err = broker.natsConn.Publish(natsSubject, data)
	if err != nil {
		return fmt.Errorf("error publishing message to NATS: %w", err)
	}

	flushTimeout := 5 * time.Second
	if NATSContext, ok := ctx.Deadline(); ok {
		flushTimeout = time.Until(NATSContext)
		if flushTimeout <= 0 {
			flushTimeout = 5 * time.Second
		}
	}
	err = broker.natsConn.FlushTimeout(flushTimeout)
	if err != nil {
		return fmt.Errorf("error flushing NATS connection: %w", err)
	}

	slog.Info("Published message to NATS", "subject", natsSubject, "message", msg)
	return nil
}

func (broker *EventBroker) Broadcast(ctx context.Context, event string, data string) error {
	msg := sseMessage{
		Type:   "broadcast",
		Event:  event,
		Data:   data,
		UserID: "",
	}
	return broker.publish(ctx, "notifications", msg)
}

func (broker *EventBroker) Notify(ctx context.Context, userID string, event string, data string) error {
	if userID == "" {
		return errors.New("user ID cannot be empty")
	}
	msg := sseMessage{
		Type:   "notification",
		UserID: userID,
		Event:  event,
		Data:   data,
	}

	return broker.publish(ctx, "notifications", msg)
}

func (broker *EventBroker) Close() error {
	if broker.natsSub != nil && broker.natsSub.IsValid() {
		err := broker.natsSub.Unsubscribe()
		if err != nil {
			return fmt.Errorf("error unsubscribing from NATS subject: %w", err)
		}
	}

	broker.mut.Lock()
	defer broker.mut.Unlock()

	for client := range broker.clients {
		close(client.Ch)
		delete(broker.clients, client)
	}

	slog.Debug("Broker closed")
	return nil
}
