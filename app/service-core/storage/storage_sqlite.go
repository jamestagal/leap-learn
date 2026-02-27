package storage

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"service-core/config"

	"github.com/tursodatabase/go-libsql"
	// _ "github.com/mattn/go-sqlite3"
)

func getPragmas() []string {
	return []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA foreign_keys = OFF;",
		"PRAGMA synchronous = NORMAL;",
		"PRAGMA temp_store = MEMORY;",
		"PRAGMA auto_vacuum = INCREMENTAL;",
		"PRAGMA cache_size = 10000;",
		"PRAGMA cache = shared;",
	}
}
func newSQLiteStorage(_ *config.Config) (*Storage, func(), error) {
	db, err := sql.Open("libsql", "file:storage/data.db")
	if err != nil {
		return nil, nil, fmt.Errorf("error creating connection: %w", err)
	}
	for _, pragma := range getPragmas() {
		ctx := context.Background()
		_, _ = db.ExecContext(ctx, pragma)
	}
	var clean = func() {
		db.Close()
	}

	return &Storage{Conn: db}, clean, nil
}

func newTursoStorage(cfg *config.Config) (*Storage, func(), error) {
	dbName := "data.db"
	dir, err := os.MkdirTemp("", "libsql-*")
	if err != nil {
		return nil, nil, fmt.Errorf("error creating temp dir: %w", err)
	}
	dbPath := filepath.Join(dir, dbName)

	connector, err := libsql.NewEmbeddedReplicaConnector(
		dbPath,
		cfg.TursoURL,
		libsql.WithAuthToken(cfg.TursoToken),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("error creating connector: %w", err)
	}

	db := sql.OpenDB(connector)

	var clean = func() {
		os.RemoveAll(dir)
		connector.Close()
		db.Close()
	}
	return &Storage{Conn: db}, clean, nil
}

func newMemoryStorage(_ *config.Config) (*Storage, func(), error) {
	db, err := sql.Open("libsql", "file::memory:?cache=shared&journal_mode=WAL")
	if err != nil {
		return nil, nil, fmt.Errorf("error creating connection: %w", err)
	}
	for _, pragma := range getPragmas() {
		ctx := context.Background()
		rows, err := db.QueryContext(ctx, pragma)
		if err != nil || rows.Err() != nil {
			return nil, nil, fmt.Errorf("error setting pragma: %w", err)
		}
		defer rows.Close()
	}
	var clean = func() {
		db.Close()
	}
	return &Storage{Conn: db}, clean, nil
}
