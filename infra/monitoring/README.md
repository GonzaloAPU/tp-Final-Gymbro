# Módulo infra/monitoring

Responsable: **Sonia**.

Agregar Prometheus, Grafana, cAdvisor y postgres-exporter; exportar dashboards.

## Estado del punto 10 — Monitoreo y visualización

- Prometheus: `prom/prometheus:v2.53.0` en `9090`.
- Grafana: `grafana/grafana:11.1.0` en `3001`.
- Exportadores: node-exporter (`9100`), cAdvisor (`8080`) y postgres-exporter (`9187`).
- Blackbox exporter: probe HTTP contra la API (`http://backend:3100/api/health`).

## Servicios (infra/monitoring/compose.yaml)

| Servicio | Imagen | Puerto host | Descripción |
|---|---|---|---|
| prometheus | prom/prometheus:v2.53.0 | 9090 | Scrapeo y alertas |
| grafana | grafana/grafana:11.1.0 | 3001 | Dashboards |
| node-exporter | prom/node-exporter:v1.7.0 | 9100 | CPU/memoria/disco/red del OS |
| cadvisor | gcr.io/cadvisor/cadvisor:v0.49.1 | 8080 | CPU/memoria/contenedores Docker |
| postgres-exporter | prometheuscommunity/postgres-exporter:v0.15.0 | - | Métricas PostgreSQL |
| blackbox-exporter | prom/blackbox-exporter:v1.0.0 | - | Probe HTTP de la API |

## Archivos

- `compose.yaml`: stack de monitoring.
- `prometheus/prometheus.yml`: scrape configs y métricas personalizadas.
- `prometheus/alerts.yml`: reglas de alerta.
- `blackbox.yml`: módulo http_2xx para probes.
- `grafana/provisioning/datasources/prometheus.yml`: datasource.
- `grafana/provisioning/dashboards/gymbro.yml`: provider de dashboards.
- `grafana/dashboards/gymbro-overview.json`: dashboard principal.

## Puertos reservados (docs/INTEGRACION.md)

| Servicio | Puerto del host |
|---|---|
| Prometheus | 9090 |
| Grafana | 3001 |
| cAdvisor | 8080 |
| node-exporter | 9100 |

## Validación

```bash
docker compose -f infra/monitoring/compose.yaml config
docker compose -f infra/monitoring/compose.yaml up -d
curl -fsS http://localhost:9090/-/ready
curl -fsS -u admin:admin http://localhost:3001/api/health
```

## Pendiente del punto 10

- Dashboard final con todos los paneles mínimos de la consigna (CPU/mem, disco, red, contenedores, disponibilidad, BD, conexiones/consultas lentas, replicación).
- Prueba de detección de condición anormal (parar contenedor / base y verificar alerta).
- Evidencia de métricas reales.

## Trabajo por ramas y PR a develop. Consultar docs/ASIGNACION.md y docs/INTEGRACION.md.
