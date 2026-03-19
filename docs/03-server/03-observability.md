---
title: "Observability"
description: "Prometheus metrics, Grafana dashboards, and logging"
last_updated: "2025-07-18"
audience:
  - devops
---

# Observability (Prometheus Metrics)

The taskbook server exposes a `/metrics` endpoint in Prometheus text format. Metrics are always enabled — no configuration is required.

## Metrics Endpoint

```bash
curl http://localhost:8080/metrics
```

Returns all metrics in Prometheus exposition format (`text/plain; version=0.0.4`).

## Exported Metrics

### HTTP Metrics

Recorded by the metrics middleware for every request:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | `method`, `route`, `status` | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status` | Request latency in seconds |
| `http_active_requests` | Gauge | `method`, `route` | In-flight HTTP requests |

Histogram buckets: 1ms, 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s.

### SSE Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `sse_active_connections` | Gauge | `endpoint` | Active SSE connections (auto-decrements on disconnect) |

### Database Pool Metrics

Updated every 15 seconds:

| Metric | Type | Description |
|--------|------|-------------|
| `db_pool_connections` | Gauge | Total connections in the pool |
| `db_pool_idle_connections` | Gauge | Idle connections in the pool |

## Prometheus Scraping

### Kubernetes (prometheus-operator)

Create a `ServiceMonitor` to scrape the metrics endpoint:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: tb-server
  labels:
    release: prometheus-operator  # Must match your Prometheus instance's serviceMonitorSelector
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: tb-server
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

### Static Prometheus Config

```yaml
scrape_configs:
  - job_name: tb-server
    metrics_path: /metrics
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:8080"]
```

## Grafana Dashboard

A pre-built Grafana dashboard is available for import. It includes:

- **Overview row**: Request rate, error rate %, average latency, active connections
- **HTTP Traffic row**: Request rate by route (stacked), request rate by status code (color-coded)
- **Latency row**: p50/p95/p99 latency by route, latency heatmap
- **Database & SSE row**: Connection pool usage, pool utilization gauge, SSE connections

The dashboard uses a `datasource` template variable of type `prometheus`, so it works with any Prometheus-compatible data source.

### Example PromQL Queries

```promql
# Request rate
sum(rate(http_requests_total{job="tb-server"}[5m]))

# Error rate percentage
sum(rate(http_requests_total{job="tb-server", status=~"5.."}[5m]))
/ sum(rate(http_requests_total{job="tb-server"}[5m])) * 100

# p95 latency by route
histogram_quantile(0.95,
  sum by (route, le) (rate(http_request_duration_seconds_bucket{job="tb-server"}[5m]))
) * 1000

# DB pool utilization
(db_pool_connections{job="tb-server"} - db_pool_idle_connections{job="tb-server"})
/ db_pool_connections{job="tb-server"} * 100
```

## Docker Compose Example

No special configuration needed — metrics are always available:

```yaml
services:
  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    environment:
      TB_DB_HOST: postgres
      TB_DB_NAME: taskbook
      TB_DB_USER: taskbook
      TB_DB_PASSWORD: taskbook
      RUST_LOG: info
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

With `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: tb-server
    scrape_interval: 15s
    static_configs:
      - targets: ["server:8080"]
```

## Logging

Structured logging is provided by `tracing` and `tracing-subscriber`. Configure the log level with the `RUST_LOG` environment variable:

```bash
RUST_LOG=debug ./tb-server    # Verbose
RUST_LOG=info ./tb-server     # Normal (default)
RUST_LOG=warn ./tb-server     # Quiet
```
