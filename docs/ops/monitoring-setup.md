# Uptime Monitoring Setup

External uptime monitoring for Webkit production services.

## Endpoints to Monitor

| Endpoint | Service | Expected |
|----------|---------|----------|
| `https://api.webkit.au/health` | Core API (Go) | 200 when DB reachable |
| `https://app.webkit.au` | Client app (SvelteKit) | 200 |
| `https://admin.webkit.au/ready` | Admin service (Go) | 200 |

## BetterStack Setup (Recommended)

1. Create a free account at [betterstack.com](https://betterstack.com)
2. Navigate to Uptime > Monitors
3. Add 3 HTTPS monitors:
   - **Core API** -- URL: `https://api.webkit.au/health`, check every 60s
   - **Client App** -- URL: `https://app.webkit.au`, check every 60s
   - **Admin** -- URL: `https://admin.webkit.au/ready`, check every 60s
4. Set alert threshold: **2 consecutive failures** before alerting
5. Configure email alerts under Settings > Notification rules

## UptimeRobot Alternative

1. Create a free account at [uptimerobot.com](https://uptimerobot.com)
2. Add 3 HTTP(s) monitors with the same URLs and 60s intervals
3. Free plan includes 50 monitors, which is more than sufficient
4. Set alert contacts under My Settings > Alert Contacts

## Optional Status Page

Both BetterStack and UptimeRobot offer free public status pages.

To set up a custom status page URL:

1. Create a status page in your monitoring provider
2. Add a CNAME DNS record in Cloudflare:
   - Name: `status`
   - Target: provider's CNAME value (e.g., `statuspage.betteruptime.com`)
3. Status page will be available at `status.webkit.au`

## What These Monitors Don't Cover

- **Gotenberg** -- Internal-only service, not externally routable. Health is checked via Docker healthcheck (`curl -f http://localhost:3000/health`)
- **NATS** -- Internal message queue, no external endpoint. Monitor indirectly via admin service health
- **Disk space** -- Use the Hostinger VPS dashboard to monitor disk usage
- **Database performance** -- Monitor indirectly via API response times in your uptime provider
- **Backup execution** -- Check `/var/log/webkit-backup.log` on VPS or verify R2 bucket contents (see `docs/ops/backup-setup.md`)
