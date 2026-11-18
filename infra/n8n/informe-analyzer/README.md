# Informe Analizador (WF3)

Servicio Python ligero (stdlib puro, sin pip installs) que recibe métricas de
Prometheus en JSON y devuelve el analisis de anomalias + un texto de resumen.

## Endpoints

| Método | Path | Body / Uso |
|---|---|---|
| `GET` | `/health` | liveness |
| `POST` | `/analyze` | `{"metrics": {"backend_up": true, "backend_probe_duration_seconds": 0.42, ...}}` → `{"anomalies": [...], "riskLevel": "OK|WARN|CRIT", "summary": "..."}` |

## Métricas ponderadas

| Métrica | Origen | Qué chequea |
|---|---|---|
| `backend_up` | `probe_success{job="blackbox",instance="http://gymbro-backend:3100/health"}` | Respuesta HTTP 200 |
| `backend_probe_duration_seconds` | `probe_duration_seconds{...}` | Latencia del backend |
| `docker_container_restart_count_total` | `docker_container_restart_count` (exporter custom) | Restarts de contenedores |
| `node_memory_MemAvailable_bytes` | `node_exporter` | Memoria disponible |

## Umbrales (configurables en `THRESHOLDS` dentro del script)

| | WARN | CRIT |
|---|---|---|
| Latencia backend | 0.5 s | 2.0 s |
| Memoria disponible | 512 MB | 256 MB |
| Restarts | 1 | — |
