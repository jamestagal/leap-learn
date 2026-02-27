#!/bin/bash

set -e
set -o pipefail

# --- Configuration ---
GITHUB_ENV="staging"
DB_REGION="europe-north1"
DB_VERSION="POSTGRES_17"
DB_TIER="db-f1-micro" # cheapest tier (approx. $16-20/month)
DB_STORAGE_TYPE="SSD"
DB_STORAGE_SIZE="10GB"
DB_EDITION="ENTERPRISE"
DB_USER="postgres"
DB_NAME="postgres"
SERVICE_ACCOUNT_NAME="github-actions-deployer"

echo "🚀 Starting GCP and Terraform Backend Initialization..."

# --- Prerequisite Checks ---
if ! command -v gcloud &> /dev/null;
    then
    echo "❌ gcloud CLI not found. Please install it and authenticate with your GCP account."
    exit 1
fi

if ! command -v gh &> /dev/null;
    then
    echo "❌ gh CLI not found. Please install it and authenticate with 'gh auth login'."
    exit 1
fi

echo "✅ Prerequisites met."

# --- Get Project Info ---
GCP_PROJECT_ID=$(gcloud config get-value project)
if [ -z "$GCP_PROJECT_ID" ];
    then
    echo "❌ No GCP project is set."
    echo "Please run 'gcloud auth login' first, then set your project using 'gcloud config set project YOUR_PROJECT_ID'."
    exit 1
fi
echo "📦 GCP Project ID: $GCP_PROJECT_ID"

GITHUB_REPOSITORY=$(gh repo view --json nameWithOwner -q .nameWithOwner)
if [ $? -ne 0 ];
    then
    echo "❌ Error: Could not determine GitHub repository. Please ensure you are in a valid git repository with a GitHub remote." >&2
    exit 1
fi
echo "📦 GitHub Repository: $GITHUB_REPOSITORY"

# --- Confirmation Step ---
echo ""
echo "Please review the configuration below:"
echo "----------------------------------------"
echo "GCP Project ID:      $GCP_PROJECT_ID"
echo "GitHub Repository:   $GITHUB_REPOSITORY"
echo "GitHub Environment:  $GITHUB_ENV"
echo "DB Region:           $DB_REGION"
echo "DB Version:          $DB_VERSION"
echo "DB Tier:             $DB_TIER"
echo "Service Account:     $SERVICE_ACCOUNT_NAME"
echo "----------------------------------------"
echo "This script will perform the following actions:"
echo "  - Enable Cloud SQL Admin, Storage, and Secret Manager APIs"
echo "  - Create a GCS bucket named '${GCP_PROJECT_ID}-tf-state'"
echo "  - Create a Service Account named '$SERVICE_ACCOUNT_NAME'"
echo "  - Grant 'Storage Object Admin', 'Cloud SQL Client', and 'Cloud SQL Instance User' roles to the Service Account"
echo "  - Create a key for the Service Account and set it as the 'GCP_SA_KEY' secret in the '$GITHUB_ENV' environment"
echo "  - Prompt for Cloud SQL instance configuration and create it (if it doesn't exist)"
echo "  - Generate a password for the database, and set it in both GCP Secret Manager and GitHub secrets"
echo "  - Set the Cloud SQL connection name as a GitHub variable"
echo ""
read -p "Are you sure you want to continue? (yes/no): " USER_CONFIRMATION
if [[ "$USER_CONFIRMATION" != "yes" ]]; then
    echo "🛑 Initialization cancelled by user."
    exit 1
fi
echo ""


# --- Enable GCP APIs ---
echo "🔄 Enabling required GCP APIs (Cloud SQL Admin, Storage, and Secret Manager)..."
gcloud services enable sqladmin.googleapis.com storage-component.googleapis.com secretmanager.googleapis.com --project="$GCP_PROJECT_ID"
echo "✅ GCP APIs enabled."

# --- Create GCS Bucket for Terraform State ---
GCS_BUCKET_NAME="${GCP_PROJECT_ID}-tf-state"
echo "🔄 Checking for GCS bucket gs://$GCS_BUCKET_NAME..."
if gcloud storage buckets describe "gs://$GCS_BUCKET_NAME" &> /dev/null;
    then
    echo "✅ GCS bucket gs://$GCS_BUCKET_NAME already exists."
else
    echo "🔄 Creating GCS bucket gs://$GCS_BUCKET_NAME..."
    gcloud storage buckets create "gs://$GCS_BUCKET_NAME" --project="$GCP_PROJECT_ID" --location="$DB_REGION" --uniform-bucket-level-access
    gcloud storage buckets update "gs://$GCS_BUCKET_NAME" --versioning
    echo "✅ GCS bucket created and versioning enabled."
fi

# --- Update Terraform Backend Configuration ---
TERRAFORM_BACKEND_TEMPLATE="backend.tf.tpl"
TERRAFORM_BACKEND_FILE="backend.tf"
echo "🔄 Configuring Terraform backend file ($TERRAFORM_BACKEND_FILE) from template..."
cp "$TERRAFORM_BACKEND_TEMPLATE" "$TERRAFORM_BACKEND_FILE"
sed -i "s/__GCS_BUCKET_NAME__/$GCS_BUCKET_NAME/" "$TERRAFORM_BACKEND_FILE"
echo "✅ Terraform backend configured."

# --- Create GCP Service Account ---
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
echo "🔄 Checking for Service Account $SERVICE_ACCOUNT_NAME..."
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$GCP_PROJECT_ID" &> /dev/null;
    then
    echo "✅ Service Account $SERVICE_ACCOUNT_NAME already exists."
else
    echo "🔄 Creating Service Account $SERVICE_ACCOUNT_NAME..."
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="GitHub Actions Deployer" \
        --project="$GCP_PROJECT_ID"
    echo "✅ Service Account created."
    echo "⏳ Waiting for 10 seconds for the new Service Account to propagate..."
    sleep 10
fi

# --- Grant IAM Roles to Service Account ---
echo "🔄 Granting IAM roles to Service Account..."
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.objectAdmin" \
    --no-user-output-enabled

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/cloudsql.client" \
    --no-user-output-enabled

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/cloudsql.instanceUser" \
    --no-user-output-enabled

echo "✅ IAM roles granted."

# --- Generate Key and Set GitHub Secret ---
echo "🔄 Generating Service Account key and setting it as GitHub secret 'GCP_SA_KEY' for the '$GITHUB_ENV' environment..."
gcloud iam service-accounts keys create --iam-account="$SERVICE_ACCOUNT_EMAIL" - | gh secret set GCP_SA_KEY --env "$GITHUB_ENV" --repo "$GITHUB_REPOSITORY"

echo "✅ GitHub secret 'GCP_SA_KEY' has been set for the '$GITHUB_ENV' environment."

# --- Prompt for Database Instance Name ---
echo ""
echo "🗄️  Cloud SQL Instance Configuration"
echo "----------------------------------------"
DEFAULT_DB_INSTANCE_NAME="${GCP_PROJECT_ID}-${GITHUB_ENV}"
echo "Enter a name for your Cloud SQL instance."
echo "This will be the identifier for your Postgres database instance in GCP."
read -p "Database instance name (default: $DEFAULT_DB_INSTANCE_NAME): " DB_INSTANCE_NAME_INPUT
DB_INSTANCE_NAME="${DB_INSTANCE_NAME_INPUT:-$DEFAULT_DB_INSTANCE_NAME}"
if [ -z "$DB_INSTANCE_NAME" ]; then
    echo "❌ Database instance name cannot be empty."
    exit 1
fi
echo "✅ Database instance name: $DB_INSTANCE_NAME"

# --- Create Cloud SQL Postgres Instance ---
DB_INSTANCE_CREATED=false
echo ""
echo "🔄 Checking for Cloud SQL instance $DB_INSTANCE_NAME..."
if gcloud sql instances describe "$DB_INSTANCE_NAME" --project="$GCP_PROJECT_ID" &> /dev/null;
    then
    echo "✅ Cloud SQL instance $DB_INSTANCE_NAME already exists."
else
    echo "This script will create a new Cloud SQL Postgres instance with the following configuration:"
    echo "  - Name: $DB_INSTANCE_NAME"
    echo "  - Type: $DB_VERSION"
    echo "  - Tier: $DB_TIER"
    echo "  - Storage: $DB_STORAGE_SIZE $DB_STORAGE_TYPE"
    echo "  - Region: $DB_REGION"
    echo "  - Edition: $DB_EDITION"
    echo ""
    read -p "Are you sure you want to create this instance? (yes/no): " DB_CREATE_CONFIRMATION
    if [[ "$DB_CREATE_CONFIRMATION" != "yes" ]]; then
        echo "🛑 Database creation cancelled by user."
    else
        echo ""
        echo "🔄 Creating Cloud SQL Postgres instance $DB_INSTANCE_NAME (this may take several minutes)..."
        gcloud sql instances create "$DB_INSTANCE_NAME" \
            --database-version="$DB_VERSION" \
            --tier="$DB_TIER" \
            --region="$DB_REGION" \
            --storage-type="$DB_STORAGE_TYPE" \
            --storage-size="$DB_STORAGE_SIZE" \
            --edition="$DB_EDITION" \
            --project="$GCP_PROJECT_ID"
        echo "✅ Cloud SQL instance created."
        DB_INSTANCE_CREATED=true
    fi
fi
echo ""

# --- Set DB Password and Secrets if Instance was Newly Created ---
if [ "$DB_INSTANCE_CREATED" = true ]; then
    echo "🔄 Generating a new password for the database..."
    DB_PASSWORD=$(openssl rand -hex 32)

    echo "🔄 Setting password for user '$DB_USER'..."
    gcloud sql users set-password "$DB_USER" --instance="$DB_INSTANCE_NAME" --password="$DB_PASSWORD" --project="$GCP_PROJECT_ID"

    GCP_SECRET_NAME="${DB_INSTANCE_NAME}-db-password"
    echo "🔄 Storing password in GCP Secret Manager as '$GCP_SECRET_NAME'..."
    # Create the secret if it doesn't exist.
    if ! gcloud secrets describe "$GCP_SECRET_NAME" --project="$GCP_PROJECT_ID" &> /dev/null; then
        gcloud secrets create "$GCP_SECRET_NAME" --replication-policy="automatic" --project="$GCP_PROJECT_ID"
    fi
    # Set the secret value by adding a version.
    echo -n "$DB_PASSWORD" | gcloud secrets versions add "$GCP_SECRET_NAME" --data-file=- --project="$GCP_PROJECT_ID"

    echo "🔄 Setting GitHub secrets for the '$GITHUB_ENV' environment..."
    gh secret set DB_NAME --body "$DB_NAME" --env "$GITHUB_ENV" --repo "$GITHUB_REPOSITORY"
    gh secret set DB_USER --body "$DB_USER" --env "$GITHUB_ENV" --repo "$GITHUB_REPOSITORY"
    gh secret set DB_PASSWORD --body "$DB_PASSWORD" --env "$GITHUB_ENV" --repo "$GITHUB_REPOSITORY"
    echo "✅ GitHub secrets DB_NAME, DB_USER, and DB_PASSWORD have been set."
fi

# --- Set Cloud SQL Connection Name ---
echo "🔄 Fetching Cloud SQL connection name..."
CLOUD_SQL_CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --project="$GCP_PROJECT_ID" --format='value(connectionName)')
if [ -z "$CLOUD_SQL_CONNECTION_NAME" ]; then
    echo "❌ Could not fetch Cloud SQL connection name for instance '$DB_INSTANCE_NAME'." >&2
    echo "Please ensure the instance exists and you have the correct permissions." >&2
    exit 1
fi
echo "📦 Cloud SQL Connection Name: $CLOUD_SQL_CONNECTION_NAME"

echo "🔄 Setting GitHub variable 'CLOUD_SQL_CONNECTION_NAME' for the '$GITHUB_ENV' environment..."
gh variable set CLOUD_SQL_CONNECTION_NAME --body "$CLOUD_SQL_CONNECTION_NAME" --env "$GITHUB_ENV" --repo "$GITHUB_REPOSITORY"
echo "✅ GitHub variable 'CLOUD_SQL_CONNECTION_NAME' has been set."

echo ""
echo "🎉 GCP initialization complete!"
