#!/bin/bash
# Deploy script for webkit production
# Usage: ./scripts/deploy.sh [service]
# Examples:
#   ./scripts/deploy.sh          # Deploy all services
#   ./scripts/deploy.sh client   # Deploy only client

set -e

# Configuration
VPS_HOST="${VPS_HOST:-root@168.231.118.209}"
VPS_PATH="/opt/webkit"
COMPOSE_FILE="docker-compose.production.yml"

SERVICE="${1:-}"

echo "🚀 Deploying webkit to production..."

# Step 1: Sync docker-compose.production.yml to server
echo "📤 Syncing $COMPOSE_FILE to server..."
scp "$COMPOSE_FILE" "$VPS_HOST:$VPS_PATH/$COMPOSE_FILE"

# Step 2: Pull and restart on server
echo "🔄 Pulling images and restarting containers..."
if [ -n "$SERVICE" ]; then
    ssh "$VPS_HOST" "cd $VPS_PATH && docker compose -f $COMPOSE_FILE pull $SERVICE && docker compose -f $COMPOSE_FILE up -d --force-recreate $SERVICE"
    echo "✅ Deployed $SERVICE successfully!"
else
    ssh "$VPS_HOST" "cd $VPS_PATH && docker compose -f $COMPOSE_FILE pull && docker compose -f $COMPOSE_FILE up -d --force-recreate"
    echo "✅ Deployed all services successfully!"
fi

# Step 3: Show status
echo ""
echo "📊 Container status:"
ssh "$VPS_HOST" "cd $VPS_PATH && docker compose -f $COMPOSE_FILE ps"
