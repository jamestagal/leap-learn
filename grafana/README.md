# GoFast Monitoring

## Setup

### Install Dependencies

```bash
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

### Add Loki to your docker compose file

Add the loki plugin to the desired service in your `docker-compose.yml` file.

```yaml
    logging:
      driver: loki
      options:
        loki-url: http://localhost:6000/loki/api/v1/push
        loki-retries: "5"
```

### Run the Prometheus next to your application

```bash
docker compose -f docker-compose.prometheus.yml up -d
```

### Start the Grafana on a separate stack

```bash
UID=$(id -u) GID=$(id -g) docker compose -f docker-compose.grafana.yml up -d
```

### Access Grafana

http://localhost:4000

Username: `admin`
Password: `admin`

### Add Prometheus Data Source

1. **Make sure that the main GoFast stack is running**.
2. Go to `Configuration` -> `Data Sources`.
3. Click on `Add data source`.
4. Select `Prometheus` as the type.
5. Set the URL to `http://host.docker.internal:9090`.
6. Click on `Save & Test`.

### Add Loki Data Source

1. Go to `Configuration` -> `Data Sources`.
2. Click on `Add data source`.
3. Select `Loki` as the type.
4. Set the URL to `http://loki:3100`.
5. Click on `Save & Test`.

### Import dashboards

1. Go to `Dashboards` -> `New` -> `Import`.
2. Enter the Dashboard ID and click on `Load`.
   - `1860` for OS metrics
   - `15798` for Docker container metrics
   - `21040` for Docker daemon metrics ([configure the Docker daemon](https://docs.docker.com/config/daemon/prometheus/))
3. Select the Prometheus data source and click on `Import`.
4. Optionally, you can checkout more dashboards at https://grafana.com/grafana/dashboards.

### Add Loki logs

1. Go to `Explore` -> `Logs`.
2. Select the Loki data source.
3. Click on `Select label` and choose `container_name`.
4. Click on `Select value` and choose your container.
5. Click on `Run query`.
6. Optionally, you can add the logs to a dashboard by clicking on `Add to dashboard`.
