# Setting Up Automated PostgreSQL Backups to Cloudflare R2

This guide walks through setting up daily automated database backups from your production VPS to Cloudflare R2 object storage.

**What you'll get:** Daily compressed PostgreSQL backups uploaded to R2, with 30-day remote retention and 7-day local retention. Runs at 2 AM daily via cron.

---

## Prerequisites

- SSH access to your VPS (`ssh root@<VPS_HOST>`)
- Cloudflare account with R2 enabled
- WebKit production stack running (PostgreSQL container named `webkit-postgres`)

---

## Step 1: Create an R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Go to **R2 Object Storage** in the left sidebar
4. Click **Create bucket**
5. Name it `webkit-backups`
6. Choose the location closest to your VPS (e.g., `APAC` for Australia)
7. Click **Create bucket**

---

## Step 2: Create R2 API Credentials

1. In the R2 section, click **Manage R2 API Tokens** (top right)
2. Click **Create API token**
3. Configure the token:
   - **Token name:** `webkit-backup-script`
   - **Permissions:** Object Read & Write
   - **Specify bucket(s):** Select `webkit-backups` only (principle of least privilege)
   - **TTL:** Leave as no expiry, or set a long duration
4. Click **Create API Token**
5. **Copy these three values immediately** (they won't be shown again):
   - Access Key ID:
   - Secret Access Key
   - Endpoint URL (looks like `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

---

## Step 3: Install rclone on Your VPS

SSH into your VPS:

```bash
ssh root@<VPS_HOST>
```

Install rclone (use the official script — the Ubuntu apt version is too old and has R2 compatibility issues):

```bash
curl https://rclone.org/install.sh | bash
```

Verify it installed:

```bash
rclone version
```

---

## Step 4: Configure rclone for R2

Create the rclone config file on the VPS:

```bash
nano /opt/webkit/.rclone.conf
```

Paste this, replacing the placeholder values with your R2 credentials from Step 2:

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = YOUR_R2_ACCESS_KEY
secret_access_key = YOUR_R2_SECRET_KEY
endpoint = https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
acl = private
no_check_bucket = true
```

> **Important:** The `no_check_bucket = true` line is required. Without it, rclone tries to verify/create the bucket before uploading, which fails with a 403 error since R2 API tokens scoped to Object Read & Write don't have bucket-creation permissions.

Lock down permissions (credentials file should only be readable by root):

```bash
chmod 600 /opt/webkit/.rclone.conf
```

Test the connection:

```bash
rclone ls r2:webkit-backups --config /opt/webkit/.rclone.conf
```

This should return empty (no errors) since the bucket is new. If you get a 403 error, double-check your credentials. Note: `rclone lsd r2:` (list all buckets) will fail with a 403 if your token is scoped to a specific bucket — that's expected.

---

## Step 5: Copy the Backup Script to the VPS

From your local machine, copy the script:

```bash
scp scripts/backup-db.sh root@<VPS_HOST>:/opt/webkit/scripts/backup-db.sh
```

Or if you prefer, SSH in and create it manually:

```bash
ssh root@<VPS_HOST>
mkdir -p /opt/webkit/scripts
nano /opt/webkit/scripts/backup-db.sh
# Paste the contents of scripts/backup-db.sh
```

Make it executable:

```bash
chmod +x /opt/webkit/scripts/backup-db.sh
```

---

## Step 6: Test the Backup Manually

Run it once to make sure everything works:

```bash
/opt/webkit/scripts/backup-db.sh
```

You should see output like:

```
[Sat Feb  8 14:00:00 AEDT 2026] Starting database backup...
[Sat Feb  8 14:00:02 AEDT 2026] Backup created: /tmp/webkit-backups/webkit_20260208_140000.sql.gz (1.2M)
[Sat Feb  8 14:00:05 AEDT 2026] Uploaded to R2: r2:webkit-backups/postgres/
[Sat Feb  8 14:00:05 AEDT 2026] Pruned remote backups older than 30 days
[Sat Feb  8 14:00:05 AEDT 2026] Cleaned local backups older than 7 days
[Sat Feb  8 14:00:05 AEDT 2026] Backup complete
```

Verify it arrived in R2:

```bash
rclone ls r2:webkit-backups/postgres/ --config /opt/webkit/.rclone.conf
```

You can also check in the Cloudflare dashboard under R2 > webkit-backups.

---

## Step 7: Set Up the Cron Job

Open the crontab editor:

```bash
crontab -e
```

Add this line at the bottom (runs daily at 2 AM server time):

```cron
0 2 * * * /opt/webkit/scripts/backup-db.sh >> /var/log/webkit-backup.log 2>&1
```

Save and exit. Verify it's registered:

```bash
crontab -l
```

Create the log file:

```bash
touch /var/log/webkit-backup.log
```

---

## Step 8: Verify It's Working (Next Day)

The next day, check the log:

```bash
cat /var/log/webkit-backup.log
```

And check R2 has the new backup:

```bash
rclone ls r2:webkit-backups/postgres/ --config /opt/webkit/.rclone.conf
```

---

## Restoring from a Backup

If you ever need to restore:

### Download the backup

```bash
# List available backups
rclone ls r2:webkit-backups/postgres/ --config /opt/webkit/.rclone.conf

# Download a specific backup
rclone copy r2:webkit-backups/postgres/webkit_20260208_020000.sql.gz /tmp/ --config /opt/webkit/.rclone.conf
```

### Restore to PostgreSQL

```bash
# Decompress and pipe into psql
gunzip -c /tmp/webkit_20260208_020000.sql.gz | docker exec -i webkit-postgres psql -U webkit -d webkit
```

> **Warning:** This overwrites the current database. If you want to restore to a separate database first to inspect it:
>
> ```bash
> # Create a temporary database
> docker exec webkit-postgres createdb -U webkit webkit_restore
>
> # Restore into it
> gunzip -c /tmp/webkit_20260208_020000.sql.gz | docker exec -i webkit-postgres psql -U webkit -d webkit_restore
>
> # Inspect it
> docker exec -it webkit-postgres psql -U webkit -d webkit_restore
>
> # Drop it when done
> docker exec webkit-postgres dropdb -U webkit webkit_restore
> ```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `docker exec: Error: No such container: webkit-postgres` | Check container name: `docker ps \| grep postgres` |
| `rclone: command not found` | Install rclone: `apt install rclone` |
| `Failed to create file system: AccessDenied` | Check credentials in `/opt/webkit/.rclone.conf` |
| `pg_dump: error: connection to server failed` | Ensure PostgreSQL container is running: `docker ps` |
| Cron not running | Check cron service: `systemctl status cron` |
| Empty backup file | Check disk space: `df -h /tmp` |

### Checking Cron Logs

```bash
# Check if cron ran
grep webkit /var/log/syslog | tail -10

# Check backup log
tail -20 /var/log/webkit-backup.log
```

---

## Summary

| Setting | Value |
|---------|-------|
| Backup frequency | Daily at 2 AM |
| Local retention | 7 days (`/tmp/webkit-backups/`) |
| Remote retention | 30 days (R2 `webkit-backups/postgres/`) |
| Config file | `/opt/webkit/.rclone.conf` |
| Script | `/opt/webkit/scripts/backup-db.sh` |
| Log file | `/var/log/webkit-backup.log` |
