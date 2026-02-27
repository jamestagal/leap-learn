# Environment Configuration Guide

## Overview

This document provides detailed configuration options for the Consultation Domain deployment across different environments. It covers all environment variables, configuration files, and environment-specific settings.

## Environment Variables Reference

### Database Configuration

#### PostgreSQL Settings
```bash
# Database Provider
DATABASE_PROVIDER=postgres

# Connection Settings
POSTGRES_HOST=localhost              # Database host
POSTGRES_PORT=5432                   # Database port (default: 5432)
POSTGRES_DB=gofast                   # Database name
POSTGRES_USER=postgres               # Database username
POSTGRES_PASSWORD=postgres           # Database password
POSTGRES_SSL_MODE=disable            # SSL mode: disable, require, verify-ca, verify-full

# Connection Pool Settings
POSTGRES_MAX_OPEN_CONNS=25          # Maximum open connections
POSTGRES_MAX_IDLE_CONNS=5           # Maximum idle connections
POSTGRES_CONN_MAX_LIFETIME=3600     # Connection max lifetime (seconds)
POSTGRES_CONN_MAX_IDLE_TIME=300     # Connection max idle time (seconds)

# Connection String (alternative to individual settings)
DATABASE_URL=postgres://user:pass@host:port/db?sslmode=disable
```

#### SQLite Settings
```bash
# Database Provider
DATABASE_PROVIDER=sqlite

# SQLite File Path
SQLITE_PATH=./data/gofast.db        # Path to SQLite database file
SQLITE_PRAGMA_JOURNAL_MODE=WAL     # Journal mode: DELETE, WAL, MEMORY
SQLITE_PRAGMA_FOREIGN_KEYS=ON      # Enable foreign key constraints
SQLITE_PRAGMA_SYNCHRONOUS=NORMAL   # Synchronous mode: OFF, NORMAL, FULL
```

#### Turso (LibSQL) Settings
```bash
# Database Provider
DATABASE_PROVIDER=turso

# Turso Configuration
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
TURSO_SYNC_INTERVAL=5000            # Sync interval in milliseconds
```

### Service Configuration

#### Core Service Settings
```bash
# Service Identity
SERVICE_NAME=service-core           # Service name for logging/metrics
SERVICE_VERSION=1.0.0              # Service version
SERVICE_ENV=production              # Environment: development, staging, production

# Network Configuration
SERVICE_HOST=0.0.0.0               # Bind host (0.0.0.0 for all interfaces)
SERVICE_HTTP_PORT=4001             # HTTP API port
SERVICE_GRPC_PORT=4002             # gRPC API port

# Graceful Shutdown
SHUTDOWN_TIMEOUT=30s               # Graceful shutdown timeout
```

#### Authentication & Authorization
```bash
# JWT Configuration
JWT_SECRET_KEY=/app/keys/private.key     # Path to JWT private key
JWT_PUBLIC_KEY=/app/keys/public.key      # Path to JWT public key
JWT_TOKEN_EXPIRY=24h                     # Token expiration duration
JWT_REFRESH_EXPIRY=168h                  # Refresh token expiration (7 days)
JWT_ISSUER=gofast                        # JWT issuer
JWT_AUDIENCE=gofast-api                  # JWT audience

# API Key Authentication (optional)
API_KEY_ENABLED=false                    # Enable API key authentication
API_KEY_HEADER=X-API-Key                 # API key header name
```

#### Rate Limiting
```bash
# Rate Limiting Configuration
RATE_LIMIT_ENABLED=true            # Enable rate limiting
RATE_LIMIT_RPS=100                 # Requests per second per IP
RATE_LIMIT_BURST=200               # Burst capacity
RATE_LIMIT_CLEANUP_INTERVAL=10m    # Cleanup interval for expired entries

# Per-endpoint rate limits
RATE_LIMIT_CREATE_RPS=10           # Creation endpoints
RATE_LIMIT_UPDATE_RPS=20           # Update endpoints
RATE_LIMIT_LIST_RPS=50             # List endpoints
```

### Message Queue Configuration

#### NATS Settings
```bash
# NATS Connection
NATS_URL=nats://localhost:4222     # NATS server URL
NATS_USER=                         # NATS username (if auth enabled)
NATS_PASSWORD=                     # NATS password (if auth enabled)
NATS_TOKEN=                        # NATS token (if auth enabled)

# Connection Options
NATS_CONNECT_TIMEOUT=10s           # Connection timeout
NATS_RECONNECT_WAIT=2s             # Reconnect wait time
NATS_MAX_RECONNECTS=60             # Maximum reconnection attempts

# JetStream Configuration
NATS_JETSTREAM_ENABLED=true        # Enable JetStream
NATS_JETSTREAM_DOMAIN=             # JetStream domain
```

### Caching Configuration

#### Redis Settings
```bash
# Redis Connection
REDIS_URL=redis://localhost:6379   # Redis connection URL
REDIS_PASSWORD=                    # Redis password
REDIS_DB=0                         # Redis database number

# Connection Pool
REDIS_POOL_SIZE=10                 # Connection pool size
REDIS_MIN_IDLE_CONNS=2             # Minimum idle connections
REDIS_POOL_TIMEOUT=30s             # Pool timeout

# Cache Settings
CACHE_TTL_DEFAULT=1h               # Default cache TTL
CACHE_TTL_CONSULTATION=30m         # Consultation cache TTL
CACHE_TTL_USER_SESSION=24h         # User session cache TTL
```

### Logging Configuration

#### Log Settings
```bash
# Logging Configuration
LOG_LEVEL=info                     # Log level: debug, info, warn, error
LOG_FORMAT=json                    # Log format: json, text
LOG_OUTPUT=stdout                  # Log output: stdout, stderr, file
LOG_FILE_PATH=./logs/app.log       # Log file path (if LOG_OUTPUT=file)

# Log Rotation (if using file output)
LOG_MAX_SIZE=100                   # Max log file size in MB
LOG_MAX_BACKUPS=5                  # Number of backup files to keep
LOG_MAX_AGE=30                     # Max age of log files in days
LOG_COMPRESS=true                  # Compress old log files

# Structured Logging
LOG_INCLUDE_CALLER=true            # Include caller information
LOG_INCLUDE_STACKTRACE=false       # Include stack trace on errors
```

### Monitoring & Observability

#### Metrics Configuration
```bash
# Metrics
ENABLE_METRICS=true                # Enable Prometheus metrics
METRICS_PORT=9090                  # Metrics server port
METRICS_PATH=/metrics              # Metrics endpoint path

# Custom Metrics
METRICS_BUSINESS_ENABLED=true      # Enable business metrics
METRICS_DB_ENABLED=true            # Enable database metrics
METRICS_HTTP_ENABLED=true          # Enable HTTP metrics
```

#### Tracing Configuration
```bash
# Distributed Tracing
ENABLE_TRACING=true                # Enable distributed tracing
TRACING_SERVICE_NAME=service-core  # Service name for tracing
TRACING_SAMPLE_RATE=0.1           # Sampling rate (0.0-1.0)

# Jaeger Configuration
JAEGER_ENDPOINT=http://localhost:14268/api/traces
JAEGER_AGENT_HOST=localhost
JAEGER_AGENT_PORT=6832

# OTLP Configuration (alternative)
OTLP_ENDPOINT=http://localhost:4317
OTLP_HEADERS=                      # Additional headers for OTLP
```

#### Health Check Configuration
```bash
# Health Checks
HEALTH_CHECK_ENABLED=true          # Enable health check endpoint
HEALTH_CHECK_PATH=/health          # Health check endpoint path
HEALTH_CHECK_TIMEOUT=30s           # Health check timeout

# Dependency Checks
HEALTH_CHECK_DB=true               # Check database connectivity
HEALTH_CHECK_NATS=true             # Check NATS connectivity
HEALTH_CHECK_REDIS=true            # Check Redis connectivity
```

### Email Configuration

#### SMTP Settings
```bash
EMAIL_PROVIDER=smtp                # Email provider: smtp, sendgrid, mailgun, local
EMAIL_FROM=noreply@gofast.live     # Default sender email
EMAIL_REPLY_TO=support@gofast.live # Reply-to email

# SMTP Configuration
SMTP_HOST=smtp.gmail.com           # SMTP server host
SMTP_PORT=587                      # SMTP server port
SMTP_USERNAME=your-email@gmail.com # SMTP username
SMTP_PASSWORD=your-app-password    # SMTP password
SMTP_TLS=true                      # Enable TLS
SMTP_STARTTLS=true                 # Enable STARTTLS
```

#### Email Service Provider Settings
```bash
# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key

# Mailgun
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_EU=false                   # Use EU endpoint

# AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### File Storage Configuration

```bash
# File Storage Provider
FILE_PROVIDER=local                # Provider: local, s3, gcs, azure

# Local Storage
LOCAL_FILE_DIR=/app/files          # Local storage directory
LOCAL_FILE_MAX_SIZE=10MB           # Maximum file size

# AWS S3
AWS_S3_BUCKET=gofast-files         # S3 bucket name
AWS_S3_REGION=us-east-1            # S3 region
AWS_S3_ACCESS_KEY=your-access-key  # S3 access key
AWS_S3_SECRET_KEY=your-secret-key  # S3 secret key

# Google Cloud Storage
GCS_BUCKET=gofast-files            # GCS bucket name
GCS_PROJECT_ID=your-project-id     # GCS project ID
GCS_CREDENTIALS_PATH=/app/gcs.json # GCS credentials file path
```

## Environment-Specific Configurations

### Development Environment

`.env.development`:
```bash
# Development Configuration
SERVICE_ENV=development
LOG_LEVEL=debug
LOG_FORMAT=text

# Database
DATABASE_PROVIDER=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=gofast_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Disable security features for development
RATE_LIMIT_ENABLED=false
CORS_ENABLED=true
CORS_ALLOW_ORIGINS=http://localhost:3000

# Enable development features
ENABLE_PPROF=true                  # Enable pprof endpoints
ENABLE_DEBUG_ENDPOINTS=true        # Enable debug endpoints
AUTO_MIGRATE=true                  # Auto-run migrations

# Development tools
AIR_ENABLED=true                   # Enable hot reload with Air
SQLC_WATCH=true                    # Watch for SQL changes
```

### Staging Environment

`.env.staging`:
```bash
# Staging Configuration
SERVICE_ENV=staging
LOG_LEVEL=info
LOG_FORMAT=json

# Database
DATABASE_PROVIDER=postgres
POSTGRES_HOST=staging-db.example.com
POSTGRES_PORT=5432
POSTGRES_DB=gofast_staging
POSTGRES_USER=staging_user
POSTGRES_PASSWORD=${STAGING_DB_PASSWORD}

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_RPS=50
CORS_ENABLED=true
CORS_ALLOW_ORIGINS=https://staging.gofast.live

# Monitoring
ENABLE_METRICS=true
ENABLE_TRACING=true
TRACING_SAMPLE_RATE=0.5           # Higher sampling for staging

# External services
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=${SENDGRID_STAGING_KEY}
```

### Production Environment

`.env.production`:
```bash
# Production Configuration
SERVICE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json

# Database
DATABASE_PROVIDER=postgres
POSTGRES_HOST=prod-db.example.com
POSTGRES_PORT=5432
POSTGRES_DB=gofast_prod
POSTGRES_USER=prod_user
POSTGRES_PASSWORD=${PROD_DB_PASSWORD}
POSTGRES_SSL_MODE=require

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_RPS=1000
RATE_LIMIT_BURST=2000
CORS_ENABLED=true
CORS_ALLOW_ORIGINS=https://gofast.live,https://app.gofast.live

# Performance
POSTGRES_MAX_OPEN_CONNS=50
POSTGRES_MAX_IDLE_CONNS=10
REDIS_POOL_SIZE=20

# Monitoring
ENABLE_METRICS=true
ENABLE_TRACING=true
TRACING_SAMPLE_RATE=0.1           # Lower sampling for production

# External services
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=${SENDGRID_PROD_KEY}
FILE_PROVIDER=s3
AWS_S3_BUCKET=gofast-prod-files

# Security tokens
JWT_SECRET_KEY=/app/keys/prod-private.key
JWT_PUBLIC_KEY=/app/keys/prod-public.key
```

## Configuration Management

### Configuration Files

#### Main Configuration (`config.yaml`)
```yaml
# Core service configuration
service:
  name: service-core
  version: 1.0.0
  environment: ${SERVICE_ENV:development}
  host: ${SERVICE_HOST:0.0.0.0}
  ports:
    http: ${SERVICE_HTTP_PORT:4001}
    grpc: ${SERVICE_GRPC_PORT:4002}
    metrics: ${METRICS_PORT:9090}

# Database configuration
database:
  provider: ${DATABASE_PROVIDER:postgres}
  postgres:
    host: ${POSTGRES_HOST:localhost}
    port: ${POSTGRES_PORT:5432}
    database: ${POSTGRES_DB:gofast}
    username: ${POSTGRES_USER:postgres}
    password: ${POSTGRES_PASSWORD:postgres}
    ssl_mode: ${POSTGRES_SSL_MODE:disable}
    pool:
      max_open: ${POSTGRES_MAX_OPEN_CONNS:25}
      max_idle: ${POSTGRES_MAX_IDLE_CONNS:5}

# Logging configuration
logging:
  level: ${LOG_LEVEL:info}
  format: ${LOG_FORMAT:json}
  output: ${LOG_OUTPUT:stdout}

# Rate limiting
rate_limit:
  enabled: ${RATE_LIMIT_ENABLED:true}
  rps: ${RATE_LIMIT_RPS:100}
  burst: ${RATE_LIMIT_BURST:200}

# Monitoring
monitoring:
  metrics:
    enabled: ${ENABLE_METRICS:true}
    port: ${METRICS_PORT:9090}
  tracing:
    enabled: ${ENABLE_TRACING:false}
    service_name: ${TRACING_SERVICE_NAME:service-core}
    sample_rate: ${TRACING_SAMPLE_RATE:0.1}
```

#### Air Configuration for Development (`.air.toml`)
```toml
root = "."
testdata_dir = "testdata"
tmp_dir = "tmp"

[build]
  args_bin = []
  bin = "./tmp/main"
  cmd = "go build -o ./tmp/main ./cmd/service-core"
  delay = 1000
  exclude_dir = ["assets", "tmp", "vendor", "testdata", "node_modules"]
  exclude_file = []
  exclude_regex = ["_test.go"]
  exclude_unchanged = false
  follow_symlink = false
  full_bin = ""
  include_dir = []
  include_ext = ["go", "tpl", "tmpl", "html", "sql"]
  kill_delay = "0s"
  log = "build-errors.log"
  send_interrupt = false
  stop_on_root = false

[color]
  app = ""
  build = "yellow"
  main = "magenta"
  runner = "green"
  watcher = "cyan"

[log]
  time = false

[misc]
  clean_on_exit = false

[screen]
  clear_on_rebuild = false
```

### Configuration Validation

Create validation script (`scripts/validate-config.sh`):
```bash
#!/bin/bash

# Configuration validation script
set -e

echo "Validating configuration..."

# Check required environment variables
REQUIRED_VARS=(
    "DATABASE_PROVIDER"
    "SERVICE_ENV"
    "JWT_SECRET_KEY"
    "JWT_PUBLIC_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Validate database configuration
case $DATABASE_PROVIDER in
    postgres)
        REQUIRED_DB_VARS=("POSTGRES_HOST" "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD")
        ;;
    sqlite)
        REQUIRED_DB_VARS=("SQLITE_PATH")
        ;;
    turso)
        REQUIRED_DB_VARS=("TURSO_DATABASE_URL" "TURSO_AUTH_TOKEN")
        ;;
    *)
        echo "Error: Unsupported DATABASE_PROVIDER: $DATABASE_PROVIDER"
        exit 1
        ;;
esac

for var in "${REQUIRED_DB_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Required database variable $var is not set"
        exit 1
    fi
done

# Validate JWT keys exist
if [ ! -f "$JWT_SECRET_KEY" ]; then
    echo "Error: JWT secret key file not found: $JWT_SECRET_KEY"
    exit 1
fi

if [ ! -f "$JWT_PUBLIC_KEY" ]; then
    echo "Error: JWT public key file not found: $JWT_PUBLIC_KEY"
    exit 1
fi

# Validate service environment
case $SERVICE_ENV in
    development|staging|production)
        echo "Service environment: $SERVICE_ENV"
        ;;
    *)
        echo "Warning: Unknown service environment: $SERVICE_ENV"
        ;;
esac

echo "Configuration validation completed successfully!"
```

### Environment Loading

Create environment loader (`scripts/load-env.sh`):
```bash
#!/bin/bash

# Environment loading script
set -e

ENV=${1:-development}
ENV_FILE=".env.${ENV}"

if [ -f "$ENV_FILE" ]; then
    echo "Loading environment from $ENV_FILE..."
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "Environment file $ENV_FILE not found, using system environment"
fi

# Load default environment if it exists
if [ -f ".env" ]; then
    echo "Loading default environment from .env..."
    export $(grep -v '^#' ".env" | xargs)
fi

# Validate configuration
sh scripts/validate-config.sh

echo "Environment loaded for: $ENV"
```

## Security Configuration

### TLS/SSL Configuration

```bash
# TLS Configuration
TLS_ENABLED=true                   # Enable TLS
TLS_CERT_PATH=/app/certs/cert.pem  # TLS certificate path
TLS_KEY_PATH=/app/certs/key.pem    # TLS private key path
TLS_MIN_VERSION=1.2                # Minimum TLS version

# Certificate management
CERT_AUTO_RELOAD=true              # Auto-reload certificates
CERT_CHECK_INTERVAL=24h            # Certificate check interval
```

### CORS Configuration

```bash
# CORS Settings
CORS_ENABLED=true                              # Enable CORS
CORS_ALLOW_ORIGINS=https://gofast.live         # Allowed origins
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS # Allowed methods
CORS_ALLOW_HEADERS=Authorization,Content-Type  # Allowed headers
CORS_EXPOSE_HEADERS=X-Total-Count             # Exposed headers
CORS_MAX_AGE=86400                            # Preflight cache duration
CORS_ALLOW_CREDENTIALS=true                   # Allow credentials
```

This comprehensive environment configuration guide ensures proper setup and security across all deployment environments.