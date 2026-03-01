# Docker Cleanup — Gotchas

## NEVER suggest `docker system prune -a --volumes`

The `--volumes` flag deletes ALL Docker volumes including `postgres_data`, which wipes the entire development database (organisations, users, H5P content, libraries, everything).

### Safe alternatives for clearing Docker cache:

```bash
# Clear build cache only (safest)
docker builder prune

# Remove unused images + stopped containers (keeps volumes/data)
docker system prune -a

# If you must clean volumes, be explicit about which ones
docker volume rm <specific-volume-name>
```

### Incident: 2026-03-01

User restarted PC, wanted to clean Docker Desktop cache. I suggested `docker system prune -a --volumes` which wiped the postgres_data volume. User lost their "Leap Learn Test" organisation and all development data. Database was recreated empty on next `docker compose up`.
