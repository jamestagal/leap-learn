#!/bin/bash

# Update Permissions Script
# Updates user permissions in the database

set -e

echo "🔐 Updating user permissions..."

# Check if user ID is provided
if [ $# -eq 0 ]; then
    echo "Usage: ./update_permissions.sh <user-id> [access-level]"
    echo "Example: ./update_permissions.sh 01997f59-c279-72b0-b35e-06b7d339e0ac 251674623"
    echo ""
    echo "Access levels:"
    echo "  Admin: 251674623 (includes all permissions)"
    echo "  User:  255 (basic user permissions)"
    exit 1
fi

USER_ID=$1
ACCESS_LEVEL=${2:-251674623}  # Default to admin permissions

# Database connection details from environment
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-postgres}
DB_USER=${POSTGRES_USER:-postgres}

echo "Updating user $USER_ID with access level $ACCESS_LEVEL"

# Update user permissions
docker compose exec postgres psql -U $DB_USER -d $DB_NAME -c "
UPDATE users
SET access = $ACCESS_LEVEL
WHERE id = '$USER_ID';

SELECT id, email, access FROM users WHERE id = '$USER_ID';
"

echo "✅ User permissions updated successfully!"