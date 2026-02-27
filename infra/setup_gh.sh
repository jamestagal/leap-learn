#!/bin/bash

set -e
set -o pipefail

# --- Configuration ---
GITHUB_ENV="staging"

echo "🚀 Starting GitHub Secrets and Variables Initialization for '$GITHUB_ENV' environment..."

# --- Prerequisite Checks ---

if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI not found. Please install it and authenticate with 'gh auth login'."
    exit 1
fi

if ! command -v openssl &> /dev/null; then
    echo "❌ openssl not found. Please install it."
    exit 1
fi

echo "✅ Prerequisites met."

# --- Get Project Info ---
OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
if [ $? -ne 0 ]; then
    echo "❌ Error: Could not determine GitHub repository. Please ensure you are in a valid git repository with a GitHub remote." >&2
    exit 1
fi
echo "📦 GitHub Repository: $OWNER_REPO"

# --- Docker Config ---
DOCKER_CONFIG_PATH="$HOME/.docker/config.json"
if [ ! -f "$DOCKER_CONFIG_PATH" ]; then
    echo "❌ Docker config file not found at $DOCKER_CONFIG_PATH."
    echo "Please log in to Docker first using 'docker login'."
    exit 1
fi
DOCKER_CONFIG_JSON=$(cat $DOCKER_CONFIG_PATH)
echo "📦 Docker config found at $DOCKER_CONFIG_PATH"

# --- Collect Information ---
echo ""
echo "--- Please provide the following information ---"

# --- Domain ---
read -p "Enter the domain for the application (e.g., example.com): " DOMAIN
if [ -z "$DOMAIN" ]; then
    echo "❌ Domain cannot be empty."
    exit 1
fi
CORE_URL="core.$DOMAIN"
CLIENT_URL="client.$DOMAIN"
GRAFANA_URL="grafana.$DOMAIN"

# --- Log Level ---
read -p "Enter the log level [info]: " LOG_LEVEL
LOG_LEVEL=${LOG_LEVEL:-info}

# --- Google OAuth ---
read -p "Enter your Google OAuth Client ID: " GOOGLE_CLIENT_ID
read -sp "Enter your Google OAuth Client Secret: " GOOGLE_CLIENT_SECRET
echo ""

# --- Generate Keys and Tokens ---
echo "🔄 Generating new Ed25519 key pair..."
openssl genpkey -algorithm Ed25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem
PRIVATE_KEY_PEM=$(cat private.pem)
PUBLIC_KEY_PEM=$(cat public.pem)
echo "✅ Ed25519 key pair generated."

echo "🔄 Generating new CRON_TOKEN..."
CRON_TOKEN=$(openssl rand -base64 32)
echo "✅ CRON_TOKEN generated."



# --- Confirmation Step ---
echo ""
echo "Please review the configuration below:"
echo "----------------------------------------"
echo "GitHub Repository:   $OWNER_REPO"
echo "GitHub Environment:  $GITHUB_ENV"
echo "Log Level:           $LOG_LEVEL"
echo "Domain:              $DOMAIN"
echo "Core URL:            $CORE_URL"
echo "Client URL:          $CLIENT_URL"
echo "Grafana URL:         $GRAFANA_URL"
echo "----------------------------------------"
echo "This script will set the following GitHub secrets and variables:"
echo "  Secrets:"
echo "    - DOCKER_CONFIG_JSON"
echo "    - PRIVATE_KEY_PEM"
echo "    - PUBLIC_KEY_PEM"
echo "    - CRON_TOKEN"
echo "    - GOOGLE_CLIENT_ID"
echo "    - GOOGLE_CLIENT_SECRET"
echo "  Variables:"
echo "    - LOG_LEVEL"
echo "    - DOMAIN"
echo "    - CORE_URL"
echo "    - CLIENT_URL"
echo "    - GRAFANA_URL"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirmation
if [[ "$confirmation" != "yes" ]]; then
    echo "🛑 Initialization cancelled by user."
    # Clean up generated files
    rm -f private.pem public.pem
    exit 1
fi
echo ""

# --- Set GitHub Secrets and Variables ---
echo "🔄 Setting GitHub secrets..."
gh secret set DOCKER_CONFIG_JSON --body "$DOCKER_CONFIG_JSON" --env $GITHUB_ENV --repo $OWNER_REPO
gh secret set PRIVATE_KEY_PEM --body "$PRIVATE_KEY_PEM" --env $GITHUB_ENV --repo $OWNER_REPO
gh secret set PUBLIC_KEY_PEM --body "$PUBLIC_KEY_PEM" --env $GITHUB_ENV --repo $OWNER_REPO
gh secret set CRON_TOKEN --body "$CRON_TOKEN" --env $GITHUB_ENV --repo $OWNER_REPO
if [ -n "$GOOGLE_CLIENT_ID" ]; then
    gh secret set GOOGLE_CLIENT_ID --body "$GOOGLE_CLIENT_ID" --env $GITHUB_ENV --repo $OWNER_REPO
fi
if [ -n "$GOOGLE_CLIENT_SECRET" ]; then
    gh secret set GOOGLE_CLIENT_SECRET --body "$GOOGLE_CLIENT_SECRET" --env $GITHUB_ENV --repo $OWNER_REPO
fi
echo "✅ Secrets set."

echo "🔄 Setting GitHub variables..."
gh variable set LOG_LEVEL --body "$LOG_LEVEL" --env $GITHUB_ENV --repo $OWNER_REPO
gh variable set DOMAIN --body "$DOMAIN" --env $GITHUB_ENV --repo $OWNER_REPO
gh variable set CORE_URL --body "$CORE_URL" --env $GITHUB_ENV --repo $OWNER_REPO
gh variable set CLIENT_URL --body "$CLIENT_URL" --env $GITHUB_ENV --repo $OWNER_REPO
gh variable set GRAFANA_URL --body "$GRAFANA_URL" --env $GITHUB_ENV --repo $OWNER_REPO
echo "✅ Variables set."

# --- Clean up ---
rm -f private.pem public.pem
echo "✅ Cleaned up temporary key files."

echo ""
echo "✅ All secrets and variables have been set for the '$GITHUB_ENV' environment."
echo "🎉 GitHub initialization complete!"
