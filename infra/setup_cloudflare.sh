#!/bin/bash

set -e
set -o pipefail

# --- Configuration ---
GITHUB_ENV="staging"
WRANGLER_CONFIG="../app/service-client/wrangler.jsonc"

echo "🚀 Starting Cloudflare Worker and DNS Setup..."

# --- Load Environment Variables ---
if [ ! -f .env ]; then
    echo "❌ .env file not found in infra/ directory."
    echo "Please create it from .env.example and configure your server details."
    exit 1
fi

set -a
source ./.env
set +a

if [ -z "$SERVER_IP_1" ]; then
    echo "❌ SERVER_IP_1 not found in .env file."
    exit 1
fi

# --- Prerequisite Checks ---
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler CLI not found. Please install it with 'npm install -g wrangler'."
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI not found. Please install it and authenticate with 'gh auth login'."
    exit 1
fi

echo "✅ Prerequisites met."

# --- Prompt for API Token (REQUIRED) ---
echo ""
echo "🔑 Cloudflare API Token Required"
echo "----------------------------------------"
echo "This script requires a Cloudflare API Token to automate DNS setup and enable PR previews."
echo ""
echo "To create a Cloudflare API Token:"
echo "  1. Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "  2. Click 'Create Token'"
echo "  3. Use 'Edit Cloudflare Workers' template OR create custom token with:"
echo "     - Account > Workers Scripts > Edit"
echo "     - Account > Workers Routes > Edit"
echo "     - Zone > DNS > Edit"
echo "     - Zone > Workers Routes > Edit"
echo ""
read -sp "Enter your Cloudflare API Token: " CLOUDFLARE_API_TOKEN
echo ""
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ API Token is required to proceed. Exiting."
    exit 1
fi
echo "✅ API Token provided."

# --- Check Wrangler Authentication ---
echo "🔄 Checking Wrangler authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not authenticated with Cloudflare."
    echo "Please authenticate using one of the following methods:"
    echo "  1. wrangler login (OAuth)"
    echo "  2. Set CLOUDFLARE_API_TOKEN environment variable"
    echo ""
    read -p "Press Enter after authenticating..."

    if ! wrangler whoami &> /dev/null; then
        echo "❌ Still not authenticated. Please authenticate and try again."
        exit 1
    fi
fi
echo "✅ Wrangler authenticated."

# --- Extract Cloudflare Account ID ---
echo "🔄 Extracting Cloudflare Account ID..."
# Use Cloudflare API to fetch accounts
CLOUDFLARE_ACCOUNTS_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")

# Check if the API call was successful
if ! echo "$CLOUDFLARE_ACCOUNTS_RESPONSE" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
    echo "⚠️  Failed to fetch accounts from Cloudflare API"
    echo "   API Response: $CLOUDFLARE_ACCOUNTS_RESPONSE"
else
    # Extract the first account ID from the response
    CLOUDFLARE_ACCOUNT_ID=$(echo "$CLOUDFLARE_ACCOUNTS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

# Validate that we got a proper account ID (should be 32 hex characters)
if [[ ! "$CLOUDFLARE_ACCOUNT_ID" =~ ^[a-f0-9]{32}$ ]]; then
    echo "⚠️  Could not auto-detect Account ID or invalid format detected."
    echo "Find it at: https://dash.cloudflare.com/ (in URL or right sidebar)"
    echo "It should be a 32-character hexadecimal string."
    read -p "Enter your Cloudflare Account ID: " CLOUDFLARE_ACCOUNT_ID
    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        echo "❌ Account ID cannot be empty."
        exit 1
    fi
fi
echo "✅ Account ID detected: $CLOUDFLARE_ACCOUNT_ID"

# --- Get Workers.dev Subdomain ---
echo "🔄 Fetching workers.dev subdomain..."
CLOUDFLARE_SUBDOMAIN_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")

# Only show response if there's an error
if ! echo "$CLOUDFLARE_SUBDOMAIN_RESPONSE" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
    echo "⚠️  Failed to fetch workers.dev subdomain"
    echo "   API Response: $CLOUDFLARE_SUBDOMAIN_RESPONSE"
fi

# Parse subdomain from nested JSON response (result.subdomain)
# Handle potential whitespace in JSON formatting
WORKERS_SUBDOMAIN=$(echo "$CLOUDFLARE_SUBDOMAIN_RESPONSE" | grep -o '"subdomain"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)".*/\1/' || true)

if [ -z "$WORKERS_SUBDOMAIN" ]; then
    echo "⚠️  Could not extract workers.dev subdomain from API response."
    echo "   Please enter it manually (without .workers.dev suffix)"
    echo "   Find it at: https://dash.cloudflare.com/ → Workers & Pages → Your subdomain"
    read -p "Enter your workers.dev subdomain: " WORKERS_SUBDOMAIN
    if [ -z "$WORKERS_SUBDOMAIN" ]; then
        echo "⚠️  No subdomain provided. Using 'pending' - you'll need to update this later."
        WORKERS_SUBDOMAIN="pending"
    fi
else
    echo "✅ Workers.dev subdomain detected: $WORKERS_SUBDOMAIN.workers.dev"
fi

# --- Get Project Info ---
GITHUB_REPOSITORY=$(gh repo view --json nameWithOwner -q .nameWithOwner)
if [ $? -ne 0 ]; then
    echo "❌ Error: Could not determine GitHub repository. Please ensure you are in a valid git repository with a GitHub remote." >&2
    exit 1
fi
echo "📦 GitHub Repository: $GITHUB_REPOSITORY"

# --- Get CONTEXT and DOMAIN from GitHub Variables ---
echo "🔄 Fetching CONTEXT from GitHub variables..."
CONTEXT=$(gh variable get CONTEXT --env $GITHUB_ENV --repo $GITHUB_REPOSITORY 2>/dev/null || echo "")
if [ -z "$CONTEXT" ]; then
    echo "❌ CONTEXT not found in GitHub variables."
    echo "   Please run 'sh setup_rke2.sh' first to set up your Kubernetes cluster and CONTEXT."
    exit 1
fi
echo "✅ Context found: $CONTEXT"

echo "🔄 Fetching DOMAIN from GitHub variables..."
DOMAIN=$(gh variable get DOMAIN --env $GITHUB_ENV --repo $GITHUB_REPOSITORY 2>/dev/null || echo "")
if [ -z "$DOMAIN" ]; then
    echo "❌ DOMAIN not found in GitHub variables."
    echo "   Please run 'sh setup_gh.sh' first to configure GitHub secrets and variables."
    exit 1
fi
echo "✅ Domain found: $DOMAIN"

# --- DNS Configuration ---
WILDCARD_DNS="*.$DOMAIN"
CLIENT_DOMAIN="client.$DOMAIN"
CORE_DOMAIN="core.$DOMAIN"
GRAFANA_DOMAIN="grafana.$DOMAIN"

# --- Set Ingress IP ---
# For staging, we use SERVER_IP_1 from .env
# For production, consider using a load balancer IP (see Production Considerations in README)
CLUSTER_INGRESS_IP="$SERVER_IP_1"

# --- Confirmation Step ---
echo ""
echo "Please review the configuration below:"
echo "----------------------------------------"
echo "GitHub Repository:     $GITHUB_REPOSITORY"
echo "GitHub Environment:    $GITHUB_ENV"
echo "Worker Name:           $CONTEXT"
echo "Base Domain:           $DOMAIN"
echo "Client Domain:         $CLIENT_DOMAIN"
echo "Core Domain:           $CORE_DOMAIN"
echo "Grafana Domain:        $GRAFANA_DOMAIN"
echo "Wildcard DNS:          $WILDCARD_DNS → $CLUSTER_INGRESS_IP"
echo "Cloudflare Account:    $CLOUDFLARE_ACCOUNT_ID"
echo "Cloudflare API Token:  ${CLOUDFLARE_API_TOKEN:0:8}...${CLOUDFLARE_API_TOKEN: -4}"
echo "Workers Subdomain:     $WORKERS_SUBDOMAIN.workers.dev"
echo "----------------------------------------"
echo "This script will perform the following actions:"
echo "  - Save Cloudflare API token and Account ID to GitHub secrets"
echo "  - Save Workers subdomain to GitHub variables"
echo "  - Update $WRANGLER_CONFIG with the client domain"
echo "  - Create wildcard DNS A record: $WILDCARD_DNS → $CLUSTER_INGRESS_IP (proxied)"
echo "    This covers: core, grafana, pr-*-core, and any future subdomains"
echo "  - Deploy the Cloudflare Worker for the SvelteKit client"
echo ""
read -p "Are you sure you want to continue? (yes/no): " USER_CONFIRMATION
if [[ "$USER_CONFIRMATION" != "yes" ]]; then
    echo "🛑 Setup cancelled by user."
    exit 1
fi
echo ""

# --- Save Cloudflare Credentials to GitHub ---
echo "🔄 Saving Cloudflare credentials to GitHub secrets..."
gh secret set CLOUDFLARE_API_TOKEN --body "$CLOUDFLARE_API_TOKEN" --env $GITHUB_ENV --repo $GITHUB_REPOSITORY
gh secret set CLOUDFLARE_ACCOUNT_ID --body "$CLOUDFLARE_ACCOUNT_ID" --env $GITHUB_ENV --repo $GITHUB_REPOSITORY
echo "✅ Cloudflare credentials saved to GitHub secrets."

echo "🔄 Saving Workers subdomain to GitHub variables..."
gh variable set WORKERS_SUBDOMAIN --body "$WORKERS_SUBDOMAIN" --env $GITHUB_ENV --repo $GITHUB_REPOSITORY
echo "✅ Workers subdomain saved to GitHub variables."

# --- Update Wrangler Config ---
echo "🔄 Configuring wrangler.jsonc from template..."
WRANGLER_TEMPLATE_PATH="$WRANGLER_CONFIG.tpl"
WRANGLER_OUTPUT_PATH="$WRANGLER_CONFIG"

if [ ! -f "$WRANGLER_TEMPLATE_PATH" ]; then
    echo "❌ wrangler.jsonc.tpl not found at $WRANGLER_TEMPLATE_PATH"
    exit 1
fi

cp "$WRANGLER_TEMPLATE_PATH" "$WRANGLER_OUTPUT_PATH"
sed -i "s/__CONTEXT_NAME__/$CONTEXT/" "$WRANGLER_OUTPUT_PATH"
sed -i "s/__CLIENT_DOMAIN__/$CLIENT_DOMAIN/" "$WRANGLER_OUTPUT_PATH"
echo "✅ wrangler.jsonc configured with name: $CONTEXT, domain: $CLIENT_DOMAIN"

# --- Create Client Environment File ---
echo "🔄 Creating environment file for client build..."
CLIENT_ENV_PATH="../app/service-client/.env"
cat > "$CLIENT_ENV_PATH" << EOF
PUBLIC_CORE_URL=https://$CORE_DOMAIN
EOF
echo "✅ Client environment file created at $CLIENT_ENV_PATH"

# --- Automated DNS Setup ---
echo ""
echo "🔄 Setting up wildcard DNS record..."

# Get Zone ID for the domain
echo "🔄 Fetching Zone ID for $DOMAIN..."
CLOUDFLARE_ZONE_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")

# Check if the API call was successful
if ! echo "$CLOUDFLARE_ZONE_RESPONSE" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
    echo "❌ Failed to fetch zones from Cloudflare API"
    echo "   Response: $CLOUDFLARE_ZONE_RESPONSE"
    echo "   Please verify:"
    echo "   - Your API token is valid"
    echo "   - The token has the required permissions"
    exit 1
fi

CLOUDFLARE_ZONE_ID=$(echo "$CLOUDFLARE_ZONE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CLOUDFLARE_ZONE_ID" ]; then
    echo "❌ Could not find Zone ID for domain $DOMAIN"
    echo "   Please verify:"
    echo "   - The domain '$DOMAIN' is added to your Cloudflare account"
    echo "   - The domain is active and not pending"
    exit 1
fi
echo "✅ Zone ID found: $CLOUDFLARE_ZONE_ID"

# Create or update wildcard DNS record
echo "🔄 Configuring wildcard DNS record: $WILDCARD_DNS → $CLUSTER_INGRESS_IP..."

# Check if record exists
DNS_RECORD_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=A&name=$WILDCARD_DNS" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")

DNS_RECORD_ID=$(echo "$DNS_RECORD_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

if [ -n "$DNS_RECORD_ID" ]; then
    # Update existing record using PATCH
    echo "   Updating existing wildcard record (ID: $DNS_RECORD_ID)..."
    DNS_UPDATE_RESPONSE=$(curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/$DNS_RECORD_ID" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"A\",\"name\":\"$WILDCARD_DNS\",\"content\":\"$CLUSTER_INGRESS_IP\",\"ttl\":1,\"proxied\":true}")
else
    # Create new record
    echo "   Creating new wildcard record..."
    DNS_UPDATE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"type\":\"A\",\"name\":\"$WILDCARD_DNS\",\"content\":\"$CLUSTER_INGRESS_IP\",\"ttl\":1,\"proxied\":true}")
fi

# Check if successful
if echo "$DNS_UPDATE_RESPONSE" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
    echo "✅ Wildcard DNS record configured successfully (Proxied)"
    echo "   This record covers: core, grafana, pr-*-core, and all subdomains"
else
    echo "❌ Failed to configure wildcard DNS record"
    echo "   Response: $DNS_UPDATE_RESPONSE"
    exit 1
fi

echo ""
echo "✅ DNS setup complete!"

# --- Deploy Cloudflare Worker ---
echo ""
echo "🔄 Deploying Cloudflare Worker..."
CLIENT_SERVICE_DIR="../app/service-client"
cd "$CLIENT_SERVICE_DIR"
npm install
if ! wrangler deploy; then
    echo "❌ Worker deployment failed."
    exit 1
fi
cd ../../infra
echo "✅ Cloudflare Worker deployed successfully."

echo ""
echo "🎉 Cloudflare setup complete!"
echo "✅ Worker deployed to https://$CLIENT_DOMAIN"
echo "✅ Wildcard DNS A record created: $WILDCARD_DNS → $CLUSTER_INGRESS_IP (Proxied)"
echo ""
echo "📝 This single wildcard DNS record now handles:"
echo "   - https://$CORE_DOMAIN (Core API)"
echo "   - https://$GRAFANA_DOMAIN (Grafana monitoring)"
echo "   - https://pr-123-core.$DOMAIN (PR preview environments)"
echo "   - Any future subdomains you add to *.${DOMAIN}"
echo ""
echo "📝 Note: The $CLIENT_DOMAIN DNS is automatically managed by Cloudflare Workers custom domains."
echo ""
echo "⏳ DNS propagation may take a few minutes. You can check status with:"
echo "   dig $CORE_DOMAIN"
echo "   dig $GRAFANA_DOMAIN"
echo "   dig pr-123-core.$DOMAIN  # Example PR preview"
