#!/bin/bash
# Database backup script for WebKit production
# Backs up PostgreSQL to local file, then syncs to Cloudflare R2
#
# Prerequisites:
#   - rclone configured with R2 endpoint (see scripts/rclone-r2.conf.example)
#   - R2 bucket 'webkit-backups' created
#
# Crontab entry (run daily at 2 AM):
#   0 2 * * * /opt/webkit/scripts/backup-db.sh >> /var/log/webkit-backup.log 2>&1
#
# Monitoring setup recommendation:
#   Use Better Stack (betterstack.com) or Uptime Robot free tier:
#   - HTTPS ping on https://api.webkit.au/health every 60s
#   - HTTPS ping on https://app.webkit.au every 60s
#   - Alert via email on downtime

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/webkit-backups"
BACKUP_FILE="${BACKUP_DIR}/webkit_${TIMESTAMP}.sql.gz"
RCLONE_CONF="/opt/webkit/.rclone.conf"
R2_REMOTE="r2:webkit-backups/postgres"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting database backup..."

# Dump database and compress
docker exec webkit-postgres pg_dump -U webkit webkit | gzip > "${BACKUP_FILE}"

FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup created: ${BACKUP_FILE} (${FILESIZE})"

# Upload to R2
if [ -f "${RCLONE_CONF}" ]; then
    rclone copy "${BACKUP_FILE}" "${R2_REMOTE}/" --config "${RCLONE_CONF}"
    echo "[$(date)] Uploaded to R2: ${R2_REMOTE}/"

    # Prune remote backups older than 30 days
    rclone delete "${R2_REMOTE}/" --min-age 30d --config "${RCLONE_CONF}"
    echo "[$(date)] Pruned remote backups older than 30 days"
else
    echo "[$(date)] WARNING: rclone config not found at ${RCLONE_CONF} — backup saved locally only"
fi

# Clean up local backups older than 7 days
find "${BACKUP_DIR}" -name "webkit_*.sql.gz" -mtime +7 -delete
echo "[$(date)] Cleaned local backups older than 7 days"

echo "[$(date)] Backup complete"
