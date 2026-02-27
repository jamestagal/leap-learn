package testdb

import (
	"database/sql"
	"fmt"
	"os"
	"testing"

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

// SetupTestDB creates a test database connection
// Uses SQLite for speed and isolation in tests
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()

	// Use SQLite for tests by default for speed and isolation
	dbPath := fmt.Sprintf("/tmp/test_%s.db", t.Name())

	// Remove any existing test database
	os.Remove(dbPath)

	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=1")
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	// Create the schema
	createSchema(t, db)

	return db
}

// TeardownTestDB closes the database connection and cleans up test files
func TeardownTestDB(t *testing.T, db *sql.DB) {
	t.Helper()

	dbPath := fmt.Sprintf("/tmp/test_%s.db", t.Name())

	if err := db.Close(); err != nil {
		t.Logf("Error closing test database: %v", err)
	}

	// Clean up test database file
	os.Remove(dbPath)
}

// createSchema creates the necessary tables for testing
func createSchema(t *testing.T, db *sql.DB) {
	t.Helper()

	// Create users table (required for foreign keys)
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			access INTEGER NOT NULL DEFAULT 0,
			sub TEXT,
			avatar TEXT,
			api_key TEXT,
			phone TEXT,
			customer_id TEXT,
			subscription_id TEXT,
			subscription_end DATETIME,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create users table: %v", err)
	}

	// Create consultations table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS consultations (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			business_name TEXT NOT NULL,
			contact_name TEXT NOT NULL,
			contact_title TEXT,
			email TEXT NOT NULL,
			phone TEXT,
			website TEXT,
			preferred_contact TEXT,
			industry TEXT NOT NULL,
			location TEXT NOT NULL,
			years_in_business INTEGER,
			team_size INTEGER,
			monthly_traffic INTEGER,
			current_platform TEXT,
			business_data TEXT NOT NULL DEFAULT '{}',
			challenges TEXT NOT NULL DEFAULT '{}',
			goals TEXT NOT NULL DEFAULT '{}',
			budget TEXT NOT NULL DEFAULT '{}',
			consultation_date DATETIME,
			duration_minutes INTEGER,
			sales_rep TEXT,
			notes TEXT,
			next_steps TEXT,
			commitment_level TEXT,
			status TEXT NOT NULL DEFAULT 'scheduled',
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id)
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create consultations table: %v", err)
	}

	// Create consultation_drafts table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS consultation_drafts (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			draft_data TEXT NOT NULL DEFAULT '{}',
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(consultation_id, user_id),
			FOREIGN KEY (user_id) REFERENCES users(id)
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create consultation_drafts table: %v", err)
	}

	// Create consultation_versions table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS consultation_versions (
			id TEXT PRIMARY KEY,
			consultation_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			version_number INTEGER NOT NULL,
			version_data TEXT NOT NULL DEFAULT '{}',
			change_description TEXT,
			created DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id),
			UNIQUE(consultation_id, version_number)
		)
	`)
	if err != nil {
		t.Fatalf("Failed to create consultation_versions table: %v", err)
	}

	// Create indexes for performance
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON consultations(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status)",
		"CREATE INDEX IF NOT EXISTS idx_consultations_created ON consultations(created)",
		"CREATE INDEX IF NOT EXISTS idx_consultation_drafts_consultation_id ON consultation_drafts(consultation_id)",
		"CREATE INDEX IF NOT EXISTS idx_consultation_drafts_user_id ON consultation_drafts(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_consultation_versions_consultation_id ON consultation_versions(consultation_id)",
		"CREATE INDEX IF NOT EXISTS idx_consultation_versions_user_id ON consultation_versions(user_id)",
	}

	for _, indexSQL := range indexes {
		_, err := db.Exec(indexSQL)
		if err != nil {
			t.Fatalf("Failed to create index: %v", err)
		}
	}
}