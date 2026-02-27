package storage

import (
	"context"
	"fmt"
	"net"
	"service-core/config"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
)

func newPostgresStorage(cfg *config.Config) (*Storage, func(), error) {
	host := net.JoinHostPort(cfg.PostgresHost, cfg.PostgresPort)
	url := fmt.Sprintf(
		"postgres://%s:%s@%s/%s?sslmode=disable",
		cfg.PostgresUser,
		cfg.PostgresPassword,
		host,
		cfg.PostgresDB,
	)

	dbpool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		return nil, nil, fmt.Errorf("error opening connection: %w", err)
	}
	var clean = func() {
		dbpool.Close()
	}

	db := stdlib.OpenDBFromPool(dbpool)
	return &Storage{Conn: db}, clean, nil
}
