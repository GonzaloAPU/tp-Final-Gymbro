# Módulo infra/monitoring

Responsable: **Sonia**.

Agregar Prometheus, Grafana, cAdvisor y postgres-exporter; exportar dashboards.

## Estado del punto 10 — Monitoreo y visualización

- Prometheus: `prom/prometheus:v2.53.0` en `9090`.
- Grafana: `grafana/grafana:11.1.0` en `3001`.
- Exportadores: windows-exporter (host Windows, nativo, puerto `9188`), cAdvisor (`8080`) y postgres-exporter (`9187`).
- Blackbox exporter: probe HTTP contra la API (`http://host.docker.internal:3100/api/health`).

## Servicios (infra/monitoring/compose.yaml)

| Servicio | Imagen | Puerto host | Descripción |
|---|---|---|---|
| prometheus | prom/prometheus:v2.53.0 | 9090 | Scrapeo y alertas |
| grafana | grafana/grafana:11.1.0 | 3001 | Dashboards |
| cadvisor | gcr.io/cadvisor/cadvisor:v0.49.1 | 8080 | CPU/memoria/contenedores Docker |
| postgres-exporter | prometheuscommunity/postgres-exporter:v0.15.0 | 9187 | Métricas PostgreSQL |
| blackbox-exporter | prom/blackbox-exporter:latest | 9115 | Probe HTTP de la API |

> Nota: el windows-exporter **no corre en contenedor** (la imagen oficial no está publicada en
> Docker Hub). Corre de forma nativa en el host Windows y Prometheus lo scrapea en
> `host.docker.internal:9188`.

## Exportador de Windows (host)

1. Descargar el binario `windows_exporter` (releases del proyecto prometheus/windows_exporter) para Windows.
2. Ejecutar: `windows_exporter.exe --web.listen-address=:9188`
3. Prometheus ya scrapea `host.docker.internal:9188` (job `windows_exporter`).

## Archivos

- `compose.yaml`: stack de monitoring (Prometheus, Grafana, cAdvisor, postgres-exporter, blackbox-exporter).
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
| postgres-exporter | 9187 |
| blackbox-exporter | 9115 |
| windows-exporter (host nativo) | 9188 |

## Validación

```bash
docker compose -f infra/monitoring/compose.yaml config
docker compose -f infra/monitoring/compose.yaml up -d
curl -fsS http://localhost:9090/-/ready
curl -fsS -u admin:admin http://localhost:3001/api/health
curl -fsS http://localhost:9115/metrics
curl -fsS http://localhost:9187/metrics
```

## Pendiente del punto 10

- Dashboard final con todos los paneles mínimos de la consigna (CPU/mem, disco, red, contenedores, disponibilidad, BD, conexiones/consultas lentas, replicación).
- Prueba de detección de condición anómala (parar contenedor / base y verificar alerta).
- Evidencia de métricas reales.

## Trabajo por ramas y PR a develop. Consultar docs/ASIGNACION.md y docs/INTEGRACION.md.
