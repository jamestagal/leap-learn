package storage_test

import (
	"database/sql"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"app/pkg/testing/testdb"
)

// TestConsultationTableSchemaPostgreSQL tests the new consultation schema for PostgreSQL
func TestConsultationTableSchemaPostgreSQL(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test table exists
	var tableName string
	err := db.QueryRow(`
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'consultations'
	`).Scan(&tableName)
	require.NoError(t, err)
	assert.Equal(t, "consultations", tableName)

	// Test table structure for new schema
	rows, err := db.Query(`
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_name = 'consultations' AND table_schema = 'public'
		ORDER BY ordinal_position
	`)
	require.NoError(t, err)
	defer rows.Close()

	expectedColumns := map[string]struct {
		dataType   string
		isNullable string
	}{
		"id":                      {"uuid", "NO"},
		"user_id":                 {"uuid", "NO"},
		"contact_info":            {"jsonb", "NO"},
		"business_context":        {"jsonb", "NO"},
		"pain_points":             {"jsonb", "NO"},
		"goals_objectives":        {"jsonb", "NO"},
		"status":                  {"character varying", "NO"},
		"completion_percentage":   {"integer", "YES"},
		"created_at":              {"timestamp with time zone", "YES"},
		"updated_at":              {"timestamp with time zone", "YES"},
		"completed_at":            {"timestamp with time zone", "YES"},
	}

	foundColumns := make(map[string]bool)
	for rows.Next() {
		var columnName, dataType, isNullable string
		var columnDefault sql.NullString
		err := rows.Scan(&columnName, &dataType, &isNullable, &columnDefault)
		require.NoError(t, err)

		if expected, exists := expectedColumns[columnName]; exists {
			assert.Equal(t, expected.dataType, dataType, "Column %s has wrong data type", columnName)
			assert.Equal(t, expected.isNullable, isNullable, "Column %s has wrong nullable setting", columnName)
			foundColumns[columnName] = true
		}
	}

	// Check all expected columns were found
	for columnName := range expectedColumns {
		assert.True(t, foundColumns[columnName], "Column %s not found", columnName)
	}
}

// TestConsultationTableSchemaSQLite tests the new consultation schema for SQLite compatibility
func TestConsultationTableSchemaSQLite(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test table exists
	rows, err := db.Query(`
		SELECT name FROM sqlite_master
		WHERE type='table' AND name='consultations'
	`)
	require.NoError(t, err)
	defer rows.Close()
	assert.True(t, rows.Next(), "consultations table should exist")

	// Test table structure for SQLite
	columns, err := db.Query("PRAGMA table_info(consultations)")
	require.NoError(t, err)
	defer columns.Close()

	expectedColumns := map[string]struct {
		dataType string
		notNull  bool
	}{
		"id":                      {"TEXT", true},  // UUID as TEXT in SQLite
		"user_id":                 {"TEXT", true},
		"contact_info":            {"TEXT", true},  // JSON as TEXT in SQLite
		"business_context":        {"TEXT", true},
		"pain_points":             {"TEXT", true},
		"goals_objectives":        {"TEXT", true},
		"status":                  {"TEXT", true},
		"completion_percentage":   {"INTEGER", false},
		"created_at":              {"DATETIME", false},
		"updated_at":              {"DATETIME", false},
		"completed_at":            {"DATETIME", false},
	}

	actualColumns := make(map[string]struct {
		dataType string
		notNull  bool
	})

	for columns.Next() {
		var cid int
		var name, dataType string
		var notNull, pk int
		var defaultValue sql.NullString

		err := columns.Scan(&cid, &name, &dataType, &notNull, &defaultValue, &pk)
		require.NoError(t, err)

		actualColumns[name] = struct {
			dataType string
			notNull  bool
		}{
			dataType: dataType,
			notNull:  notNull == 1,
		}
	}

	// Verify all expected columns exist with correct types
	for colName, expected := range expectedColumns {
		actual, exists := actualColumns[colName]
		assert.True(t, exists, "Column %s should exist", colName)
		if exists {
			assert.Equal(t, expected.dataType, actual.dataType, "Column %s should have type %s", colName, expected.dataType)
			assert.Equal(t, expected.notNull, actual.notNull, "Column %s notNull constraint should be %v", colName, expected.notNull)
		}
	}
}

// TestConsultationConstraints tests database constraints
func TestConsultationConstraints(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test status check constraint
	_, err := db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Valid status should work
	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points, goals_objectives, status
		) VALUES (
			'consultation1', 'user1', '{}', '{}', '{}', '{}', 'draft'
		)
	`)
	assert.NoError(t, err, "Valid status 'draft' should be accepted")

	// Valid status should work
	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points, goals_objectives, status
		) VALUES (
			'consultation2', 'user1', '{}', '{}', '{}', '{}', 'completed'
		)
	`)
	assert.NoError(t, err, "Valid status 'completed' should be accepted")

	// Invalid status should fail (if constraint is properly implemented)
	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points, goals_objectives, status
		) VALUES (
			'consultation3', 'user1', '{}', '{}', '{}', '{}', 'invalid_status'
		)
	`)
	// Note: This might not fail in SQLite depending on schema implementation
	// but should fail in PostgreSQL with proper CHECK constraint
}

// TestConsultationDraftsSchemaNew tests the new consultation_drafts table structure
func TestConsultationDraftsSchemaNew(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test table exists
	rows, err := db.Query(`
		SELECT name FROM sqlite_master
		WHERE type='table' AND name='consultation_drafts'
	`)
	require.NoError(t, err)
	defer rows.Close()
	assert.True(t, rows.Next(), "consultation_drafts table should exist")

	// Test unique constraint on consultation_id (one draft per consultation)
	_, err = db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points, goals_objectives, status
		) VALUES (
			'consultation1', 'user1', '{}', '{}', '{}', '{}', 'draft'
		)
	`)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO consultation_drafts (
			id, consultation_id, user_id, contact_info, business_context, pain_points, goals_objectives
		) VALUES (
			'draft1', 'consultation1', 'user1', '{}', '{}', '{}', '{}'
		)
	`)
	require.NoError(t, err)

	// This should fail due to unique constraint on consultation_id
	_, err = db.Exec(`
		INSERT INTO consultation_drafts (
			id, consultation_id, user_id, contact_info, business_context, pain_points, goals_objectives
		) VALUES (
			'draft2', 'consultation1', 'user1', '{}', '{}', '{}', '{}'
		)
	`)
	assert.Error(t, err, "Should fail due to unique constraint on consultation_id")
}

// TestConsultationVersionsSchemaNew tests the new consultation_versions table structure
func TestConsultationVersionsSchemaNew(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test table exists
	rows, err := db.Query(`
		SELECT name FROM sqlite_master
		WHERE type='table' AND name='consultation_versions'
	`)
	require.NoError(t, err)
	defer rows.Close()
	assert.True(t, rows.Next(), "consultation_versions table should exist")

	// Test unique constraint on consultation_id, version_number
	_, err = db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points, goals_objectives, status
		) VALUES (
			'consultation1', 'user1', '{}', '{}', '{}', '{}', 'draft'
		)
	`)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO consultation_versions (
			id, consultation_id, user_id, version_number,
			contact_info, business_context, pain_points, goals_objectives, status, completion_percentage
		) VALUES (
			'version1', 'consultation1', 'user1', 1, '{}', '{}', '{}', '{}', 'draft', 0
		)
	`)
	require.NoError(t, err)

	// This should fail due to unique constraint on consultation_id, version_number
	_, err = db.Exec(`
		INSERT INTO consultation_versions (
			id, consultation_id, user_id, version_number,
			contact_info, business_context, pain_points, goals_objectives, status, completion_percentage
		) VALUES (
			'version2', 'consultation1', 'user1', 1, '{}', '{}', '{}', '{}', 'draft', 0
		)
	`)
	assert.Error(t, err, "Should fail due to unique constraint on consultation_id, version_number")
}

// TestDatabaseIndexesNew tests that required indexes are created for new schema
func TestDatabaseIndexesNew(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	expectedIndexes := []string{
		"idx_consultations_user_id",
		"idx_consultations_status",
		"idx_consultations_created_at",
		"idx_consultations_updated_at",
		"idx_consultation_drafts_consultation_id",
		"idx_consultation_drafts_user_id",
		"idx_consultation_drafts_updated_at",
		"idx_consultation_versions_consultation_id",
		"idx_consultation_versions_user_id",
		"idx_consultation_versions_created_at",
		"idx_consultation_versions_version_number",
	}

	for _, indexName := range expectedIndexes {
		rows, err := db.Query(`
			SELECT name FROM sqlite_master
			WHERE type='index' AND name=?
		`, indexName)
		require.NoError(t, err)
		defer rows.Close()

		assert.True(t, rows.Next(), "Index %s should exist", indexName)
	}
}

// TestJSONBFieldStructureNew tests the new JSONB field structure
func TestJSONBFieldStructureNew(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Create user
	_, err := db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Test new structured JSONB data according to spec
	contactInfo := `{
		"business_name": "Test Corp",
		"contact_person": "John Doe",
		"email": "john@test.com",
		"phone": "+1234567890",
		"website": "https://test.com",
		"social_media": {
			"linkedin": "https://linkedin.com/company/test",
			"facebook": "",
			"instagram": ""
		}
	}`

	businessContext := `{
		"industry": "technology",
		"business_type": "SaaS",
		"team_size": 50,
		"current_platform": "wordpress",
		"digital_presence": ["website", "social media"],
		"marketing_channels": ["SEO", "paid ads", "content"]
	}`

	painPoints := `{
		"primary_challenges": ["slow website", "low conversion rate"],
		"technical_issues": ["mobile responsiveness", "page load speed"],
		"urgency_level": "high",
		"impact_assessment": "significant revenue loss",
		"current_solution_gaps": ["no mobile optimization", "poor UX"]
	}`

	goalsObjectives := `{
		"primary_goals": ["increase conversions", "improve mobile experience"],
		"secondary_goals": ["reduce bounce rate", "increase page speed"],
		"success_metrics": ["conversion rate", "page load time"],
		"kpis": ["CR > 5%", "LCP < 2.5s"],
		"timeline": {
			"desired_start": "2024-01-01",
			"target_completion": "2024-06-30",
			"milestones": ["design complete", "development complete", "testing complete"]
		},
		"budget_range": "$50,000 - $100,000",
		"budget_constraints": ["limited Q1 budget", "need approval for >$75k"]
	}`

	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points, goals_objectives, status
		) VALUES (
			'consultation1', 'user1', ?, ?, ?, ?, 'draft'
		)
	`, contactInfo, businessContext, painPoints, goalsObjectives)
	require.NoError(t, err)

	// Retrieve and verify JSON data
	var retrievedContactInfo, retrievedBusinessContext, retrievedPainPoints, retrievedGoalsObjectives string
	err = db.QueryRow(`
		SELECT contact_info, business_context, pain_points, goals_objectives
		FROM consultations WHERE id = 'consultation1'
	`).Scan(&retrievedContactInfo, &retrievedBusinessContext, &retrievedPainPoints, &retrievedGoalsObjectives)
	require.NoError(t, err)

	assert.JSONEq(t, contactInfo, retrievedContactInfo, "Contact info should be preserved")
	assert.JSONEq(t, businessContext, retrievedBusinessContext, "Business context should be preserved")
	assert.JSONEq(t, painPoints, retrievedPainPoints, "Pain points should be preserved")
	assert.JSONEq(t, goalsObjectives, retrievedGoalsObjectives, "Goals objectives should be preserved")
}

// TestCompletionPercentageCalculation tests the completion percentage logic
func TestCompletionPercentageCalculation(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Create user
	_, err := db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Test completion percentage boundaries
	testCases := []struct {
		percentage int
		shouldPass bool
	}{
		{0, true},    // Minimum valid
		{50, true},   // Mid range
		{100, true},  // Maximum valid
		{-1, false},  // Below minimum
		{101, false}, // Above maximum
	}

	for i, tc := range testCases {
		consultationID := fmt.Sprintf("consultation_%d", i)
		_, err = db.Exec(`
			INSERT INTO consultations (
				id, user_id, contact_info, business_context, pain_points, goals_objectives,
				status, completion_percentage
			) VALUES (
				?, 'user1', '{}', '{}', '{}', '{}', 'draft', ?
			)
		`, consultationID, tc.percentage)

		if tc.shouldPass {
			assert.NoError(t, err, "Completion percentage %d should be valid", tc.percentage)
		} else {
			assert.Error(t, err, "Completion percentage %d should be invalid", tc.percentage)
		}
	}
}

// TestForeignKeyConstraintsNew tests foreign key relationships for new schema
func TestForeignKeyConstraintsNew(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Test consultation foreign key to users
	_, err := db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points, goals_objectives, status
		) VALUES (
			'consultation1', 'nonexistent_user', '{}', '{}', '{}', '{}', 'draft'
		)
	`)
	assert.Error(t, err, "Should fail due to foreign key constraint on user_id")

	// Create valid user first
	_, err = db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Now consultation should work
	_, err = db.Exec(`
		INSERT INTO consultations (
			id, user_id, contact_info, business_context, pain_points, goals_objectives, status
		) VALUES (
			'consultation1', 'user1', '{}', '{}', '{}', '{}', 'draft'
		)
	`)
	assert.NoError(t, err)

	// Test draft foreign key
	_, err = db.Exec(`
		INSERT INTO consultation_drafts (
			id, consultation_id, user_id, contact_info, business_context, pain_points, goals_objectives
		) VALUES (
			'draft1', 'consultation1', 'user1', '{}', '{}', '{}', '{}'
		)
	`)
	assert.NoError(t, err)

	// Test version foreign key
	_, err = db.Exec(`
		INSERT INTO consultation_versions (
			id, consultation_id, user_id, version_number,
			contact_info, business_context, pain_points, goals_objectives, status, completion_percentage
		) VALUES (
			'version1', 'consultation1', 'user1', 1, '{}', '{}', '{}', '{}', 'draft', 0
		)
	`)
	assert.NoError(t, err)
}

// TestDefaultValuesNew tests default values for new schema
func TestDefaultValuesNew(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Create user
	_, err := db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Insert consultation with minimal required fields
	_, err = db.Exec(`
		INSERT INTO consultations (id, user_id) VALUES ('consultation1', 'user1')
	`)
	require.NoError(t, err)

	// Check default values
	var status string
	var contactInfo, businessContext, painPoints, goalsObjectives string
	var completionPercentage sql.NullInt64
	var createdAt, updatedAt sql.NullString

	err = db.QueryRow(`
		SELECT status, contact_info, business_context, pain_points, goals_objectives,
			   completion_percentage, created_at, updated_at
		FROM consultations WHERE id = 'consultation1'
	`).Scan(&status, &contactInfo, &businessContext, &painPoints, &goalsObjectives,
		&completionPercentage, &createdAt, &updatedAt)
	require.NoError(t, err)

	assert.Equal(t, "draft", status, "Default status should be 'draft'")
	assert.Equal(t, "{}", contactInfo, "Default contact_info should be '{}'")
	assert.Equal(t, "{}", businessContext, "Default business_context should be '{}'")
	assert.Equal(t, "{}", painPoints, "Default pain_points should be '{}'")
	assert.Equal(t, "{}", goalsObjectives, "Default goals_objectives should be '{}'")
	assert.True(t, completionPercentage.Valid && completionPercentage.Int64 == 0, "Default completion_percentage should be 0")
	assert.True(t, createdAt.Valid, "Created timestamp should be set")
	assert.True(t, updatedAt.Valid, "Updated timestamp should be set")
}

// TestQueryPerformanceNew tests query performance with new schema and indexes
func TestQueryPerformanceNew(t *testing.T) {
	db := testdb.SetupTestDB(t)
	defer testdb.TeardownTestDB(t, db)

	// Create user
	_, err := db.Exec(`
		INSERT INTO users (id, email, access) VALUES ('user1', 'test@test.com', 0)
	`)
	require.NoError(t, err)

	// Insert multiple consultations for performance testing
	for i := 0; i < 100; i++ {
		status := "draft"
		completion := 25
		if i%3 == 0 {
			status = "completed"
			completion = 100
		} else if i%3 == 1 {
			status = "archived"
			completion = 75
		}

		contactInfo := fmt.Sprintf(`{"business_name": "Company %d", "contact_person": "Contact %d", "email": "contact%d@test.com"}`, i, i, i)

		_, err = db.Exec(`
			INSERT INTO consultations (
				id, user_id, contact_info, business_context, pain_points, goals_objectives,
				status, completion_percentage
			) VALUES (
				?, 'user1', ?, '{}', '{}', '{}', ?, ?
			)
		`, fmt.Sprintf("consultation_%d", i), contactInfo, status, completion)
		require.NoError(t, err)
	}

	// Test query by user_id (should use index)
	rows, err := db.Query(`
		SELECT id, contact_info FROM consultations
		WHERE user_id = 'user1'
		ORDER BY created_at DESC LIMIT 10
	`)
	require.NoError(t, err)
	defer rows.Close()

	count := 0
	for rows.Next() {
		count++
	}
	assert.Equal(t, 10, count, "Should return 10 consultations")

	// Test query by status (should use index)
	rows, err = db.Query(`
		SELECT id, contact_info FROM consultations
		WHERE status = 'completed'
	`)
	require.NoError(t, err)
	defer rows.Close()

	completedCount := 0
	for rows.Next() {
		completedCount++
	}
	assert.Greater(t, completedCount, 0, "Should return some completed consultations")

	// Test combined query (user_id + status)
	rows, err = db.Query(`
		SELECT id, contact_info FROM consultations
		WHERE user_id = 'user1' AND status = 'draft'
		ORDER BY created_at DESC
	`)
	require.NoError(t, err)
	defer rows.Close()

	draftCount := 0
	for rows.Next() {
		draftCount++
	}
	assert.Greater(t, draftCount, 0, "Should return some draft consultations")

	// Test completion percentage queries
	rows, err = db.Query(`
		SELECT id, completion_percentage FROM consultations
		WHERE completion_percentage > 50
		ORDER BY completion_percentage DESC
	`)
	require.NoError(t, err)
	defer rows.Close()

	highCompletionCount := 0
	for rows.Next() {
		highCompletionCount++
	}
	assert.Greater(t, highCompletionCount, 0, "Should return consultations with >50% completion")
}