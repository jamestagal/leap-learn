package storage

import (
	"database/sql"
	"service-core/config"
)

type Storage struct {
	Conn *sql.DB
}

func NewStorage(cfg *config.Config) (*Storage, func(), error) {
	switch cfg.DatabaseProvider {
	case "postgres":
		return newPostgresStorage(cfg)
	case "sqlite":
		return newSQLiteStorage(cfg)
	case "turso":
		return newTursoStorage(cfg)
	default:
		return newMemoryStorage(cfg)
	}
}
