#!/bin/bash

# Seed Development User Script
# Creates a development user with admin permissions

set -e

echo "👤 Seeding development user..."

# Default development user details
DEV_EMAIL=${DEV_EMAIL:-"dev@gofast.local"}
DEV_PHONE=${DEV_PHONE:-"+1234567890"}
DEV_ACCESS=${DEV_ACCESS:-251674623}  # Admin access level
DEV_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')

# Database connection details from environment
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-postgres}
DB_USER=${POSTGRES_USER:-postgres}

echo "Creating development user with email: $DEV_EMAIL"

# Insert development user
docker compose exec postgres psql -U $DB_USER -d $DB_NAME -c "
INSERT INTO users (id, email, phone, access, avatar, subscription_active, created_at, updated_at)
VALUES (
    '$DEV_UUID',
    '$DEV_EMAIL',
    '$DEV_PHONE',
    $DEV_ACCESS,
    'https://github.com/identicons/$DEV_UUID.png',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    access = EXCLUDED.access,
    subscription_active = EXCLUDED.subscription_active,
    updated_at = NOW();

SELECT id, email, phone, access FROM users WHERE email = '$DEV_EMAIL';
"

echo "✅ Development user seeded successfully!"
echo "📧 Email: $DEV_EMAIL"
echo "🔑 User ID: $DEV_UUID"
echo "🛡️  Access Level: $DEV_ACCESS (Admin)"