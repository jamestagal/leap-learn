
## Infrastructure Setup

Follow these steps to provision the necessary infrastructure for the application.

### 1. Set Up Local Environment

First, create an `.env` file inside the `infra/` directory. You can copy the example file to get started:

```bash
cp .env.example .env
```

Next, edit `infra/.env` and fill in the details for the server(s) you have provisioned. This includes IP addresses, SSH users, and paths to your private keys for each server and agent node.

### 2. Set Up Kubernetes Cluster (RKE2)

This script installs a high-availability RKE2 Kubernetes cluster on your server nodes.

**What it does:**
- Installs RKE2 on the first server node (control plane)
- Optionally installs RKE2 on additional server nodes (2 or 3 node HA setup)
- Optionally installs RKE2 agent on worker nodes
- Configures your local kubeconfig to connect to the cluster
- Creates the `staging` environment in your GitHub repository
- Sets the `KUBE_CONFIG` secret in the staging environment

Run the setup script:

```bash
sh setup_rke2.sh
```

The script will prompt you to confirm all server/agent details before proceeding.

### 3. Set Up GitHub Secrets and Variables

This script configures all the necessary secrets and variables for your GitHub Actions CI/CD pipeline.

**What it does:**
- Generates Ed25519 key pair for JWT token signing
- Generates a CRON_TOKEN for secure cron job authentication
- Sets GitHub secrets in the staging environment:
  - `PRIVATE_KEY_PEM` / `PUBLIC_KEY_PEM` (for JWT signing)
  - `CRON_TOKEN` (for cron job authentication)
  - `DOCKER_CONFIG_JSON` (for Docker registry access)
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (for OAuth)
- Sets GitHub variables in the staging environment:
  - `LOG_LEVEL`, `DOMAIN`, `CORE_URL`, `CLIENT_URL`, `GRAFANA_URL`

Before running it, ensure you're authenticated with GitHub CLI and logged into Docker:

```bash
gh auth login
docker login
```

Run the setup script:

```bash
sh setup_gh.sh
```

The script will prompt you for domain information and OAuth credentials.

### 4. Set Up GCP and Terraform Backend

This script automates the entire GCP setup, including creating the Terraform state bucket, service accounts, and Cloud SQL database.

**What it does:**
- Enables required GCP APIs (Cloud SQL, Storage, Secret Manager)
- Creates a GCS bucket for Terraform state with versioning enabled
- Configures the Terraform backend configuration file
- Creates a service account with necessary permissions for GitHub Actions
- Sets the `GCP_SA_KEY` secret in GitHub
- Creates a Cloud SQL PostgreSQL instance (with cost confirmation)
- Generates and securely stores the database password in GCP Secret Manager
- Sets database connection secrets in GitHub

Before running it, ensure you are authenticated with the necessary CLIs:

```bash
gh auth login
gcloud auth login
```

Switch to the desired GCP project:

```bash
gcloud config set project YOUR_GCP_PROJECT_ID
```

Run the setup script:

```bash
sh setup_gcp.sh
```

The script will prompt you twice for confirmation:
1. First for GCP infrastructure setup (buckets, service accounts)
2. Second for Cloud SQL instance creation (shows estimated monthly cost ~$16-20)

### 5. Set Up Cloudflare Worker and DNS

This script deploys the SvelteKit client as a Cloudflare Worker and automatically configures all DNS records for your domain.

**What it does:**
- Prompts for a Cloudflare API Token (required for automation)
- Fetches your domain and context from GitHub variables
- Uses `SERVER_IP_1` from `.env` for DNS configuration (for production, use a load balancer IP)
- Shows configuration summary including API token and Account ID for review/approval
- Saves Cloudflare credentials to GitHub secrets (after approval)
- Updates `wrangler.jsonc` from the template with your client domain
- **Automatically creates/updates DNS A records** for `core.$DOMAIN` and `grafana.$DOMAIN` (proxied)
- Deploys the SvelteKit app to Cloudflare Workers (only if DNS setup succeeds)

**Prerequisites:**

Before running it, authenticate with Wrangler:

```bash
wrangler login
# OR set CLOUDFLARE_API_TOKEN environment variable
```

You'll also need to create a Cloudflare API Token with these permissions:
- Account > Workers Scripts > Edit
- Account > Workers Routes > Edit
- **Zone > DNS > Edit** (for automated DNS setup)
- Zone > Workers Routes > Edit

Create your token at: https://dash.cloudflare.com/profile/api-tokens

**Run the setup script:**

```bash
sh setup_cloudflare.sh
```

The script will:
1. Prompt for your Cloudflare API Token (this is now **required**)
2. Show a configuration summary and ask for approval (includes API token, Account ID, domain, and server IP)
3. Save Cloudflare credentials to GitHub secrets
4. Configure wrangler with your client domain
5. Automatically create DNS records (no manual setup needed!)
6. Deploy the worker to Cloudflare (only if DNS setup succeeds)

**Note:** The `client.$DOMAIN` DNS record is automatically managed by Cloudflare Workers custom domains. The script creates proxied A records for `core.$DOMAIN` and `grafana.$DOMAIN`, enabling Cloudflare's DDoS protection, SSL, and CDN automatically.

### 6. Deploy Application

Create a release to trigger the CI/CD pipeline that automatically handles everything.

**What the GitHub Actions workflow does:**
- Runs linting and tests
- Executes database migrations
- Builds the `service-core` Docker image and pushes to GitHub Container Registry
- Runs `terraform apply` to deploy all infrastructure and services to Kubernetes

**Environment Targeting:**
- **Pre-releases** (e.g., `v0.1.0-rc`) target the `staging` environment
- **Standard releases** (e.g., `v1.0.0`) target the `production` environment
- You can modify environment targeting in `.github/workflows/*.yml` files

Create a pre-release for staging:

```bash
gh release create v0.1.0-rc --prerelease --title "Staging Release" --notes "Initial staging deployment"
```

Or create a standard release for production:

```bash
gh release create v1.0.0 --title "Production Release" --notes "Initial production deployment"
```

Monitor the deployment in GitHub Actions or check your Kubernetes cluster:

```bash
# Watch the GitHub Actions workflow
gh run watch

# Check Kubernetes resources
kubectl get pods -n default
kubectl get pods -n monitoring
kubectl get ingress -A
```

Your application should now be fully deployed and accessible at:
- `https://client.$DOMAIN` (SvelteKit client on Cloudflare Workers)
- `https://core.$DOMAIN` (Go backend on Kubernetes)
- `https://grafana.$DOMAIN` (Observability dashboard)

## PR Preview Environments

Preview environments allow you to test changes from pull requests in isolated, temporary deployments before merging to main.

### How It Works

When you add the `preview` label to a pull request, GitHub Actions automatically:
1. Builds a PR-specific Docker image tagged as `pr-{number}`
2. Creates an isolated Kubernetes namespace `pr-{number}`
3. Deploys a dedicated PostgreSQL 18 database with 2Gi storage
4. Runs database migrations
5. Deploys the service-core application
6. Creates an ingress with URL pattern: `https://pr-{number}-core.{DOMAIN}`
7. Builds and deploys the SvelteKit client to Cloudflare Workers
8. Posts a comment on the PR with both frontend and backend preview URLs

### Using Preview Environments

**To deploy a preview environment:**
1. Open your pull request
2. Add the `preview` label to the PR
3. Wait for the `PR Preview Deploy` workflow to complete (~5-10 minutes)
4. Check the PR comments for the preview URL

**To update the preview environment:**
- Push new commits to the PR branch
- The preview environment will automatically rebuild and redeploy

**Cleanup:**
- Preview environments are automatically deleted when:
  - The PR is closed (merged or abandoned)
  - The `preview` label is removed

### Preview Environment Specifications

- **Backend**:
  - Namespace: `pr-{number}` (e.g., `pr-123`)
  - URL: `https://pr-{number}-core.{DOMAIN}` (e.g., `https://pr-123-core.example.com`)
  - Database: PostgreSQL 18 (in-cluster pod with persistent volume)
  - Resources: Lower limits than production (1 replica, 100m CPU, 128Mi RAM)
  - Monitoring: All telemetry sent to shared monitoring stack

- **Frontend**:
  - Cloudflare Worker: `pr-{number}-{CONTEXT}`
  - URL: `https://pr-{number}-{CONTEXT}.{WORKERS_SUBDOMAIN}.workers.dev` (e.g., `https://pr-123-gofast-app.gofast-live.workers.dev`)
  - Connected to PR-specific backend API

- **Isolation**: Complete isolation per PR (separate namespace, database, secrets, and worker)

### Prerequisites

Before using PR preview environments, ensure:
- Wildcard DNS is configured for `*.core.{DOMAIN}` pointing to your cluster
- The `staging` GitHub environment has all required secrets and variables configured:
  - `CONTEXT` - App/worker name (set via `infra/setup_gh.sh`)
  - `WORKERS_SUBDOMAIN` - Cloudflare Workers subdomain (e.g., `gofast-live`)
  - `CLOUDFLARE_API_TOKEN` - API token for deploying workers
  - `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
  - (Run `infra/setup_cloudflare.sh` to automatically configure Cloudflare credentials)
- NGINX ingress controller is running in the cluster
- Sufficient cluster resources for additional workloads

### Limitations

- Preview environments use in-cluster PostgreSQL (not Cloud SQL) for speed and cost
- Lower resource limits compared to staging/production
- No automatic cleanup after time period (manual label removal required)
- Maximum concurrent previews limited by cluster resources

## Production Considerations

The setup above is optimized for staging environments. For production deployments, consider the following improvements:

### High Availability

**Load Balancer**
- Create a Hetzner Load Balancer to distribute traffic across multiple server nodes
- Update DNS A records to point to the load balancer IP instead of a single server
- Configure health checks for automatic failover

**Multiple Server Nodes**
- Configure `SERVER_IP_2` and `SERVER_IP_3` in `.env` for a 3-node control plane
- Ensures cluster survives individual node failures
- Provides better resource distribution

**Storage**
- Replace `local-path-provisioner` with Longhorn for distributed storage
- Provides data replication across nodes
- Survives node failures without data loss

### Database

**Cloud SQL Instance**
- Upgrade from `db-f1-micro` to a production-tier instance (e.g., `db-n1-standard-1`)
- Enable automated backups and point-in-time recovery
- Configure high availability (HA) with automatic failover
- Adjust storage size based on expected data growth

### Security

**Secrets Management**
- Rotate JWT keys and tokens regularly
- Use separate environments for staging and production with different secrets
- Enable audit logging for sensitive operations

**Network Security**
- Configure firewall rules to restrict access to necessary ports only
- Use private networking between cluster nodes when possible
- Enable SSL/TLS with valid certificates (Let's Encrypt via cert-manager)

### Monitoring and Scaling

**Resource Limits**
- Review and adjust CPU/memory limits in `monitoring.tf` and `service-core.tf`
- Set appropriate retention periods for Prometheus, Loki, and Tempo based on storage capacity
- Configure alerts for critical metrics (CPU, memory, disk usage, error rates)

**Horizontal Scaling**
- Increase replica counts for the core service based on traffic
- Consider adding dedicated agent nodes for workload isolation
- Monitor and scale Cloud SQL read replicas if needed
