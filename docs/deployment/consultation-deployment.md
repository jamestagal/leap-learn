# Consultation Domain Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Consultation Domain as part of the GoFast microservices application. The deployment includes database setup, service configuration, environment variables, and monitoring setup.

## Prerequisites

### System Requirements
- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Go** 1.21+ (for local development)
- **PostgreSQL** 13+ or **SQLite** 3.35+ (for database)
- **NATS** 2.9+ (for message queue)
- **Redis** 6.2+ (for caching, optional)

### Required Tools
- **Atlas** for database migrations
- **SQLC** for query generation
- **Air** for hot reloading (development)
- **JWT keys** for authentication

## Environment Variables

### Core Service Configuration

```bash
# Database Configuration
DATABASE_PROVIDER=postgres        # postgres, sqlite, turso
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=gofast
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_SSL_MODE=disable

# SQLite Configuration (alternative)
SQLITE_PATH=./data/gofast.db

# Turso Configuration (alternative)
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# JWT Authentication
JWT_SECRET_KEY=path/to/private.key
JWT_PUBLIC_KEY=path/to/public.key
JWT_TOKEN_EXPIRY=24h

# Service Configuration
SERVICE_HOST=0.0.0.0
SERVICE_HTTP_PORT=4001
SERVICE_GRPC_PORT=4002
SERVICE_ENV=production          # development, staging, production

# NATS Message Queue
NATS_URL=nats://localhost:4222

# Redis Caching (optional)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Logging
LOG_LEVEL=info                  # debug, info, warn, error
LOG_FORMAT=json                 # json, text

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_RPS=100
RATE_LIMIT_BURST=200
```

### Email Service Configuration (for notifications)

```bash
EMAIL_PROVIDER=smtp             # smtp, sendgrid, mailgun, local
EMAIL_FROM=noreply@gofast.live

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_TLS=true

# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key

# Mailgun Configuration
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_API_KEY=your-mailgun-api-key
```

## Docker Configuration

### Development Environment

Create `docker-compose.consultation.yml` for consultation domain development:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: gofast-postgres
    environment:
      POSTGRES_DB: gofast
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  nats:
    image: nats:2.9-alpine
    container_name: gofast-nats
    ports:
      - "4222:4222"
      - "8222:8222"
    command: ["-js", "-m", "8222"]
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8222/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: gofast-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  service-core:
    build:
      context: .
      dockerfile: app/service-core/Dockerfile
      target: development
    container_name: gofast-core
    ports:
      - "4001:4001"  # HTTP API
      - "4002:4002"  # gRPC API
      - "9090:9090"  # Metrics
    environment:
      DATABASE_PROVIDER: postgres
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: gofast
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      NATS_URL: nats://nats:4222
      REDIS_URL: redis://redis:6379
      SERVICE_ENV: development
      LOG_LEVEL: debug
      ENABLE_METRICS: true
      RATE_LIMIT_ENABLED: false
    volumes:
      - ./app/service-core:/app
      - ./keys:/app/keys
    depends_on:
      postgres:
        condition: service_healthy
      nats:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  default:
    name: gofast-network
```

### Production Environment

Create `docker-compose.prod.yml` for production deployment:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: gofast-postgres-prod
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_prod_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - backend
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  nats:
    image: nats:2.9-alpine
    container_name: gofast-nats-prod
    command: ["-js", "-m", "8222", "--cluster_name", "gofast"]
    networks:
      - backend
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'
    volumes:
      - nats_data:/data
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8222/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  redis:
    image: redis:7-alpine
    container_name: gofast-redis-prod
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    networks:
      - backend
    volumes:
      - redis_prod_data:/data
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  service-core:
    image: gofast/service-core:latest
    container_name: gofast-core-prod
    ports:
      - "4001:4001"
      - "4002:4002"
    environment:
      DATABASE_PROVIDER: postgres
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      NATS_URL: nats://nats:4222
      REDIS_URL: redis://redis:6379
      SERVICE_ENV: production
      LOG_LEVEL: info
      LOG_FORMAT: json
      ENABLE_METRICS: true
      ENABLE_TRACING: true
      RATE_LIMIT_ENABLED: true
      RATE_LIMIT_RPS: 1000
      RATE_LIMIT_BURST: 2000
      JWT_SECRET_KEY: /app/keys/private.key
      JWT_PUBLIC_KEY: /app/keys/public.key
    volumes:
      - ./keys:/app/keys:ro
      - ./logs:/app/logs
    networks:
      - backend
      - frontend
    depends_on:
      postgres:
        condition: service_healthy
      nats:
        condition: service_healthy
      redis:
        condition: service_healthy
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: gofast-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    networks:
      - frontend
    depends_on:
      - service-core
    restart: always

volumes:
  postgres_prod_data:
  redis_prod_data:
  nats_data:

networks:
  backend:
    driver: bridge
  frontend:
    driver: bridge
```

### Dockerfile for Service Core

Create `app/service-core/Dockerfile`:

```dockerfile
# Multi-stage build for Go service
FROM golang:1.21-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o service-core \
    ./cmd/service-core

# Development stage with hot reload
FROM golang:1.21-alpine AS development

WORKDIR /app

# Install air for hot reloading
RUN go install github.com/cosmtrek/air@latest

# Copy source code
COPY . .

# Expose ports
EXPOSE 4001 4002 9090

# Use air for hot reloading
CMD ["air", "-c", ".air.toml"]

# Production stage
FROM alpine:latest AS production

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/service-core .

# Copy configuration files
COPY --from=builder /app/configs ./configs

# Create non-root user
RUN adduser -D -s /bin/sh appuser
USER appuser

# Expose ports
EXPOSE 4001 4002 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4001/health || exit 1

# Run the binary
CMD ["./service-core"]
```

## Database Migration Guide

### Setup Atlas for Migrations

1. **Install Atlas CLI**:
```bash
curl -sSf https://atlasgo.sh | sh
```

2. **Configure Atlas** (`atlas.hcl`):
```hcl
env "postgres" {
  src = "file://app/service-core/storage/schema"
  url = "postgres://postgres:postgres@localhost:5432/gofast?sslmode=disable"
  migration {
    dir = "file://migrations/postgres"
  }
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}

env "sqlite" {
  src = "file://app/service-core/storage/schema"
  url = "sqlite://gofast.db"
  migration {
    dir = "file://migrations/sqlite"
  }
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}
```

3. **Generate Migration Script** (`scripts/atlas.sh`):
```bash
#!/bin/bash

# Atlas migration script for consultation domain
set -e

DB_TYPE=${1:-postgres}

echo "Running Atlas migrations for $DB_TYPE..."

case $DB_TYPE in
  postgres)
    echo "Migrating PostgreSQL database..."
    atlas migrate apply \
      --env postgres \
      --url "postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-gofast}?sslmode=disable"
    ;;
  sqlite)
    echo "Migrating SQLite database..."
    atlas migrate apply \
      --env sqlite \
      --url "sqlite://${SQLITE_PATH:-./gofast.db}"
    ;;
  turso)
    echo "Migrating Turso database..."
    atlas migrate apply \
      --env sqlite \
      --url "${TURSO_DATABASE_URL}?authToken=${TURSO_AUTH_TOKEN}"
    ;;
  *)
    echo "Unsupported database type: $DB_TYPE"
    echo "Supported types: postgres, sqlite, turso"
    exit 1
    ;;
esac

echo "Migration completed successfully!"
```

### Migration Commands

```bash
# Generate new migration
atlas migrate diff consultation_domain \
  --env postgres \
  --to file://app/service-core/storage/schema

# Apply migrations to development database
sh scripts/atlas.sh postgres

# Apply migrations to production database
POSTGRES_HOST=prod-db.example.com \
POSTGRES_USER=prod_user \
POSTGRES_PASSWORD=prod_pass \
POSTGRES_DB=gofast_prod \
sh scripts/atlas.sh postgres

# Rollback migrations (if needed)
atlas migrate down \
  --env postgres \
  --url "postgres://user:pass@host:5432/db?sslmode=disable" \
  --amount 1
```

### Data Seeding

Create `scripts/seed.sql` for initial data:

```sql
-- Insert sample consultation data for testing
INSERT INTO consultations (
  id, user_id, contact_info, business_context, pain_points, goals_objectives,
  status, completion_percentage
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',  -- Test user ID
  '{"business_name": "Acme Corp", "contact_person": "John Doe", "email": "john@acme.com"}',
  '{"industry": "Technology", "business_type": "SaaS", "team_size": 25}',
  '{"primary_challenges": ["Slow website"], "urgency_level": "high"}',
  '{"primary_goals": ["Improve performance"], "budget_range": "10k-25k"}',
  'completed',
  100
);

-- Insert sample user for testing (if not exists)
INSERT INTO users (id, email, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  'Test User',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
```

## Deployment Procedures

### Development Deployment

1. **Generate JWT Keys**:
```bash
sh scripts/keys.sh
```

2. **Generate SQLC Code**:
```bash
sh scripts/sqlc.sh postgres
```

3. **Start Development Environment**:
```bash
docker-compose -f docker-compose.consultation.yml up --build
```

4. **Run Migrations**:
```bash
sh scripts/atlas.sh postgres
```

5. **Seed Test Data** (optional):
```bash
psql -h localhost -U postgres -d gofast -f scripts/seed.sql
```

### Staging Deployment

1. **Build Production Image**:
```bash
docker build -f app/service-core/Dockerfile \
  --target production \
  -t gofast/service-core:staging .
```

2. **Deploy to Staging**:
```bash
# Set staging environment variables
export POSTGRES_HOST=staging-db.example.com
export POSTGRES_USER=staging_user
export POSTGRES_PASSWORD=staging_pass
export POSTGRES_DB=gofast_staging

# Deploy services
docker-compose -f docker-compose.staging.yml up -d

# Run migrations
sh scripts/atlas.sh postgres

# Verify deployment
curl -f http://staging.example.com/health
```

### Production Deployment

1. **Pre-deployment Checklist**:
   - [ ] Database backup completed
   - [ ] SSL certificates valid
   - [ ] Environment variables configured
   - [ ] JWT keys generated and secured
   - [ ] Monitoring configured
   - [ ] Load balancer configured

2. **Database Backup**:
```bash
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d_%H%M%S).sql
```

3. **Deploy Production**:
```bash
# Build and tag production image
docker build -f app/service-core/Dockerfile \
  --target production \
  -t gofast/service-core:$(git rev-parse --short HEAD) \
  -t gofast/service-core:latest .

# Push to registry
docker push gofast/service-core:latest

# Deploy with zero downtime
docker-compose -f docker-compose.prod.yml up -d --scale service-core=2

# Run migrations
sh scripts/atlas.sh postgres

# Verify health
curl -f https://api.gofast.live/health

# Scale down old instances
docker-compose -f docker-compose.prod.yml up -d --scale service-core=2
```

## Nginx Configuration

Create `nginx.conf` for reverse proxy:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream service_core {
        server service-core:4001;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name api.gofast.live;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.gofast.live;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000" always;

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://service_core;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Health check (no rate limiting)
        location /health {
            proxy_pass http://service_core;
            access_log off;
        }

        # Metrics (restricted access)
        location /metrics {
            allow 10.0.0.0/8;
            deny all;
            proxy_pass http://service_core:9090;
        }
    }
}
```

## Health Checks and Monitoring

### Health Check Endpoint

The service provides a comprehensive health check at `/health`:

```json
{
  "status": "healthy",
  "timestamp": "2025-09-23T10:00:00Z",
  "version": "1.0.0",
  "uptime": "2h30m15s",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": "2ms"
    },
    "nats": {
      "status": "healthy",
      "latency": "1ms"
    },
    "redis": {
      "status": "healthy",
      "latency": "1ms"
    }
  }
}
```

### Monitoring Setup

1. **Prometheus Configuration** (`prometheus.yml`):
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'gofast-core'
    static_configs:
      - targets: ['service-core:9090']
    metrics_path: /metrics
    scrape_interval: 15s
```

2. **Grafana Dashboard** (see Task 6.5 for detailed dashboard configuration)

### Log Aggregation

Configure structured logging with log levels and JSON formatting for production environments. Logs are written to stdout and can be collected by log aggregation systems like ELK stack or Fluentd.

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
```bash
# Check database connectivity
docker exec -it gofast-postgres psql -U postgres -d gofast -c "SELECT 1;"

# Check service logs
docker logs gofast-core
```

2. **Migration Failures**:
```bash
# Check migration status
atlas migrate status --env postgres

# Manual migration rollback
atlas migrate down --env postgres --amount 1
```

3. **Performance Issues**:
```bash
# Check service metrics
curl http://localhost:9090/metrics

# Monitor database performance
docker exec -it gofast-postgres psql -U postgres -d gofast -c "
  SELECT query, calls, total_time, mean_time
  FROM pg_stat_statements
  ORDER BY total_time DESC
  LIMIT 10;"
```

4. **Memory Issues**:
```bash
# Check container resource usage
docker stats gofast-core

# Check Go memory profile
curl http://localhost:9090/debug/pprof/heap > heap.prof
go tool pprof heap.prof
```

### Recovery Procedures

1. **Service Recovery**:
```bash
# Restart service
docker-compose restart service-core

# Scale up replicas
docker-compose up -d --scale service-core=3
```

2. **Database Recovery**:
```bash
# Restore from backup
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB < backup.sql

# Check data integrity
sh scripts/verify-data.sh
```

This deployment guide provides comprehensive instructions for deploying the consultation domain in various environments with proper monitoring, security, and recovery procedures.