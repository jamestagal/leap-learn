#!/bin/bash

# Database Migration Runner
# Runs all SQL migrations in order from the migrations/ folder
# All migrations are idempotent (safe to run multiple times)
# Tracks applied migrations in schema_migrations table

set -e

# Configuration
MIGRATIONS_DIR="$(dirname "$0")/../migrations"

# Determine environment and set connection details
if [ "$1" = "production" ] || [ "$1" = "prod" ]; then
    echo "Running migrations on PRODUCTION..."
    echo ""
    echo "This will connect via SSH to your VPS and run migrations."
    echo "Make sure you have SSH access configured."
    echo ""
    read -p "Continue? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Aborted."
        exit 1
    fi

    # Production: Run via Docker on VPS
    # Expects VPS_HOST, VPS_USER env vars or defaults
    VPS_HOST="${VPS_HOST:-your-vps-host}"
    VPS_USER="${VPS_USER:-root}"

    echo ""
    echo "Copying migrations to VPS..."
    ssh "$VPS_USER@$VPS_HOST" 'mkdir -p /tmp/webkit_migrations'
    scp -r "$MIGRATIONS_DIR"/*.sql "$VPS_USER@$VPS_HOST:/tmp/webkit_migrations/"

    echo "Running migrations..."
    ssh "$VPS_USER@$VPS_HOST" 'for f in $(ls /tmp/webkit_migrations/*.sql | sort); do
        filename=$(basename "$f")
        version=$(echo "$filename" | grep -oE "^[0-9]+" | sed "s/^0*//")
        if [ -z "$version" ]; then
            echo "Skipping $filename (no version number)"
            continue
        fi
        # Check if schema_migrations table exists and if version is already applied
        already_applied=$(docker exec -i webkit-postgres psql -U webkit -d webkit -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '\''schema_migrations'\'') AND EXISTS(SELECT 1 FROM schema_migrations WHERE version = $version);" 2>/dev/null || echo "f")
        if [ "$already_applied" = "t" ]; then
            echo "Skipping: $filename (already applied)"
            continue
        fi
        echo "Running: $filename"
        docker exec -i webkit-postgres psql -U webkit -d webkit < "$f"
        # Record migration if tracking table exists
        docker exec -i webkit-postgres psql -U webkit -d webkit -c "INSERT INTO schema_migrations (version, filename) VALUES ($version, '\''$filename'\'') ON CONFLICT (version) DO NOTHING;" 2>/dev/null || true
    done'

    echo ""
    echo "Cleaning up..."
    ssh "$VPS_USER@$VPS_HOST" 'rm -rf /tmp/webkit_migrations'

else
    echo "Running migrations on LOCAL development..."
    echo ""

    # Local: Run via Docker Compose
    CONTAINER="webkit-postgres"
    DB_USER="postgres"
    DB_NAME="postgres"

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
        echo "Error: Container '$CONTAINER' is not running."
        echo "Start it with: docker compose up -d"
        exit 1
    fi

    # Run each migration in order
    for migration in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration" ]; then
            filename=$(basename "$migration")
            # Extract version number from filename prefix (e.g., 001 -> 1)
            version=$(echo "$filename" | grep -oE "^[0-9]+" | sed 's/^0*//')
            if [ -z "$version" ]; then
                echo "Skipping $filename (no version number)"
                continue
            fi
            # Check if schema_migrations table exists and version already applied
            already_applied=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') AND EXISTS(SELECT 1 FROM schema_migrations WHERE version = $version);" 2>/dev/null || echo "f")
            if [ "$already_applied" = "t" ]; then
                echo "Skipping: $filename (already applied)"
                continue
            fi
            echo "Running: $filename"
            docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$migration"
            # Record migration if tracking table exists
            docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO schema_migrations (version, filename) VALUES ($version, '$filename') ON CONFLICT (version) DO NOTHING;" 2>/dev/null || true
            echo "  Done."
        fi
    done
fi

echo ""
echo "All migrations completed successfully!"
