# Database Backup Setup

Automated daily PostgreSQL backups to Cloudflare R2 via `scripts/backup-db.sh`.

## Prerequisites

1. **Install rclone on VPS:**
   ```bash
   curl https://rclone.org/install.sh | sudo bash
   ```

2. **Create R2 bucket** `webkit-backups` in the Cloudflare dashboard (Storage & Databases > R2).

3. **Generate R2 API token** with read/write access to the `webkit-backups` bucket.

## Configuration

1. **Copy rclone config to VPS:**
   ```bash
   scp scripts/rclone-r2.conf.example root@VPS:/opt/webkit/.rclone.conf
   ```

2. **Edit with actual R2 credentials:**
   ```bash
   ssh root@VPS
   nano /opt/webkit/.rclone.conf
   ```
   Fill in `access_key_id`, `secret_access_key`, and `endpoint` from the R2 API token.

3. **Create local backup directory:**
   ```bash
   mkdir -p /tmp/webkit-backups
   ```

## Activation

Add the crontab entry to run daily at 2 AM:

```bash
crontab -e
```

Add this line:

```
0 2 * * * /opt/webkit/scripts/backup-db.sh >> /var/log/webkit-backup.log 2>&1
```

## Verification

1. **Manual test run:**
   ```bash
   /opt/webkit/scripts/backup-db.sh
   ```

2. **Check R2 bucket contents:**
   ```bash
   rclone ls r2:webkit-backups/postgres --config /opt/webkit/.rclone.conf
   ```

3. **Check local backups:**
   ```bash
   ls -lh /tmp/webkit-backups/
   ```

4. **Check cron log:**
   ```bash
   tail -f /var/log/webkit-backup.log
   ```

## Restore Procedure

1. **Download backup from R2:**
   ```bash
   rclone copy r2:webkit-backups/postgres/webkit_YYYYMMDD_HHMMSS.sql.gz /tmp/ --config /opt/webkit/.rclone.conf
   ```

2. **Decompress:**
   ```bash
   gunzip /tmp/webkit_YYYYMMDD_HHMMSS.sql.gz
   ```

3. **Restore into PostgreSQL:**
   ```bash
   docker exec -i webkit-postgres psql -U webkit -d webkit < /tmp/webkit_YYYYMMDD_HHMMSS.sql
   ```

   For a clean restore (drop and recreate):
   ```bash
   docker exec -i webkit-postgres psql -U webkit -c "DROP DATABASE webkit; CREATE DATABASE webkit OWNER webkit;"
   docker exec -i webkit-postgres psql -U webkit -d webkit < /tmp/webkit_YYYYMMDD_HHMMSS.sql
   ```

## Retention Policy

- **Remote (R2):** 30 days (auto-pruned by backup script)
- **Local (`/tmp/webkit-backups/`):** 7 days (auto-pruned by backup script)

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `rclone: command not found` | rclone not installed | Run `curl https://rclone.org/install.sh \| sudo bash` |
| `WARNING: rclone config not found` | Missing or wrong config path | Ensure `/opt/webkit/.rclone.conf` exists with valid credentials |
| `Error: No such container: webkit-postgres` | PostgreSQL container not running | Run `docker compose -f docker-compose.production.yml up -d postgres` |
| `permission denied` | Script not executable | Run `chmod +x /opt/webkit/scripts/backup-db.sh` |
| Backup file is 0 bytes | Database is empty or pg_dump failed | Check `docker exec webkit-postgres pg_dump -U webkit webkit` manually |
| R2 upload fails | Invalid credentials or bucket doesn't exist | Verify credentials with `rclone lsd r2: --config /opt/webkit/.rclone.conf` |
