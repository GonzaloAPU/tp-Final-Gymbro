# Módulo infra/monitoring

Responsable: **Sonia**.

Monitoreo y visualización con Prometheus y Grafana (Punto 10).

## Arquitectura

```
VM Linux (Docker Desktop)                        Windows host
┌─────────────────────────────────────────────┐  ┌────────────────┐
│  Prometheus (scraping 15s)                  │  │                │
│    ├─> node-exporter   (VM Linux)  9100     │  │                │
│    ├─> cAdvisor        (contenedores) 8080  │  │  Windows 10    │
│    ├─> docker-exporter (estado/reinicios)   │  │  (navegador →  │
│    │      9189                              │  │   Grafana,9090)│
│    ├─> postgres-exporter (PostgreSQL TP)    │  │                │
│    │      9187                              │  ├────────────────┤
│    ├─> blackbox-exporter (probe API) 9115   │  │  Prometheus ↔  │
│    └─> Prometheus self scrape             │  │   Grafana(3001)│
│  Grafana 3001                               ├──┤                │
│    └─> Prometheus datasource (3001→9090)    │  └────────────────┘
└─────────────────────────────────────────────┘
```

| Servicio | Imagen | Puerto host | Datos que entrega |
|---|---|---|---|
| prometheus | prom/prometheus:v2.53.0 | 9090 | Scrapeo + evaluación de reglas |
| grafana | grafana/grafana:11.1.0 | 3001 | Dashboards (datasource provisionado) |
| node-exporter | prom/node-exporter:v1.7.0 | 9100 | CPU, memoria, disco, red del VM Linux |
| cAdvisor | gcr.io/cadvisor/cadvisor:v0.49.1 | 8080 | CPU/memoria/disco/red por contenedor |
| cadvisor-layerdb-init | alpine:3.20 | - | Genera `layerdb` emulado (init, una vez por `up`) |
| postgres-exporter | prometheuscommunity/postgres-exporter:v0.15.0 | 9187 | pg_up, conexiones, etc. |
| blackbox-exporter | prom/blackbox-exporter:latest | 9115 | Probe HTTP del backend |
| docker-exporter | python:3.12-alpine + script | 9189 | Estado (running/stopped) y RestartCount por contenedor (API de Docker) |

## cAdvisor y Docker Desktop (containerd)

Docker Desktop usa el **containerd image store**: no existe `/var/lib/docker/image/overlayfs/layerdb`, que cAdvisor requiere. Por eso hay un init container `cadvisor-layerdb-init` (alpine, `restart: "no"`) que genera en un volumen el `layerdb` emulado (un `mount-id` por container ID → `rootfs/overlayfs/<container-id>`). Se regenera en cada `up -d`.

Además cAdvisor corre con `cgroup: host` y monta `/sys/fs/cgroup:ro`, `/var/run/docker.sock:ro` y `/var/lib/docker/containers:ro`. Sin `cgroup: host` no ve los cgroups hermanos (solo reporta `/`).

## docker-exporter (estado/reinicios de contenedores)

Script propio en `infra/monitoring/docker-stats-exporter/exporter.py` (Python stdlib, sin dependencias). Consulta la API de Docker (`/var/run/docker.sock`) cada scrape y expone:

- `docker_container_running{name,id}` — 1 en ejecución, 0 detenido.
- `docker_container_restart_count{name,id}` — `RestartCount` real del motor Docker (counter).
- `docker_exporter_up` — 1.

cAdvisor **no** expone reinicios (`container_restart_count` / `container_last_restart_time_seconds` no existen en v0.49.1 — verificado). Este exporter lo cubre sin invenciones.

## Prometheus (`infra/monitoring/prometheus/prometheus.yml` + `alerts.yml`)

Scrape cada 15s; reglas evaluadas cada 15s.

| Job | Target | Métricas clave |
|---|---|---|
| prometheus | localhost:9090 | up, estado propio |
| node_exporter | node-exporter:9100 | `node_cpu_seconds_total`, `node_memory_MemAvailable_bytes`, `node_filesystem_avail_bytes/size_bytes`, `node_network_receive_bytes_total` |
| cadvisor | cadvisor:8080 | `container_cpu_usage_seconds_total`, `container_memory_usage_bytes`, `container_network_{receive,transmit}_bytes_total`, `container_start_time_seconds` |
| docker | docker-exporter:9189 | `docker_container_running`, `docker_container_restart_count` |
| postgres_exporter | postgres-exporter:9187 | `pg_up`, `pg_stat_activity_count` |
| blackbox_backend | blackbox-exporter:9115 (`metrics_path: /probe`) | `probe_success`, `probe_duration_seconds` |

**Alertas** (`alerts.yml`):

| Regla | Expresión (resumen) | for | Severidad |
|---|---|---|---|
| BackendDown | `probe_success{job="blackbox_backend"} == 0` | 2m | critical |
| BackendHighLatency | `probe_duration_seconds{job="blackbox_backend"} > 2` | 10m | warning |
| PostgresDown | `pg_up == 0` | 2m | critical |
| HighMemoryUsage | `100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) > 85` | 10m | warning |
| HighCpuUsage | `100 * (1 - sum by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) / sum by (instance) (rate(node_cpu_seconds_total[5m]))) > 85` | 10m | warning |
| ContainerDown | `docker_container_running{name=~"gymbro-.*", name!="gymbro-cadvisor-layerdb-init"} == 0` | 2m | critical |
| ContainerRestarting | `increase(docker_container_restart_count{name=~"gymbro-.*"}[10m]) > 0` | 1m | warning |

Las alertas de contenedor cubren solo el prefijo `gymbro-*` (sin ruido de contenedores ajenos).

## Dashboard `Gymbro AI - Overview`

12 paneles: Backend availability · Backend latency · CPU VM · Memoria VM · Disco VM (por disco) · Red VM RX · CPU por contenedor · Memoria por contenedor · PostgreSQL connections · PostgreSQL exporter status (`pg_up`) · **Contenedores (estado RUNNING/STOPPED)** · **Contenedores (reinicios acumulados)**. Unidades: porcentajes/bytes/segundos según panel. Datasource provisionado: `Prometheus` (`http://prometheus:9090`), folder `Gymbro AI`.

## Levantar / detener el monitoreo

```bash
docker compose -f infra/monitoring/compose.yaml config --quiet
docker compose -f infra/monitoring/compose.yaml up -d
docker compose -f infra/monitoring/compose.yaml ps
docker compose -f infra/monitoring/compose.yaml down        # detener todo
docker compose -f infra/monitoring/compose.yaml restart prometheus
```

Grafana por defecto: `admin` / `admin` (override con `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` en el entorno).

Para que el backend quede disponible (necesario para el probe y para los tests):

```bash
# El backend ya tiene imagen construida (smartgymbro-backend:latest)
docker run -d --name gymbro-backend --restart unless-stopped --network gymbro_network \
  -p 3100:3100 --env-file <TEMP>\gymbro-backend.env \
  smartgymbro-backend:latest
# <TEMP>\gymbro-backend.env debe contener (valores reales locales, NO commitear):
#   PORT=3100
#   NODE_ENV=production
#   DATABASE_URL=postgresql://<user>:<pass>@postgres-primary:5432/smartgymbro_tp
#   JWT_SECRET=...
#   FRONTEND_URL=http://localhost:4300
# NOTA: `docker compose up -d backend` de la raíz NO es usable mientras postgres/compose.yaml
# posea el puerto 55433 (ver Limitaciones).
```

## Postgres exporter: credenciales

El DSN se toma de `POSTGRES_DATA_SOURCE`, autocargable desde `infra/monitoring/.env` (gitignored):

```bash
cp .env.example .env   # completar con el password real del postgres TP
```

`infra/monitoring/.env` no se commitea (`.gitignore` lo excluye). `.env.example` documenta el placeholder. No hay contraseñas en el repo.

## Verificar métricas

```powershell
curl -fsS http://localhost:9100/metrics
curl -fsS http://localhost:8080/metrics
curl -fsS http://localhost:9189/metrics
curl -fsS http://localhost:9187/metrics     # debe mostrar pg_up 1
curl -fsS "http://localhost:3100/api/health"
curl -fsS -u admin:admin http://localhost:3001/api/health
curl -fsS "http://localhost:9090/api/v1/targets"
```

Consultas de ejemplo (Prometheus → Explore):

```promql
sum by (name) (rate(container_cpu_usage_seconds_total{name!=""}[5m]))
sum by (instance) (rate(node_network_receive_bytes_total{device!="lo"}[5m]))
probe_success{job="blackbox_backend"}
pg_stat_activity_count
```

## Reproducir las pruebas de alertas

1. Estado normal → `probe_success = 1`, todas las reglas `inactive` (`http://localhost:9090/api/v1/rules`).
2. `docker stop gymbro-backend` → ~2m → `BackendDown` y `ContainerDown` pasan a `firing` (verificado con `curl http://localhost:9090/api/v1/alerts`).
3. `docker start gymbro-backend` → ~2m → ambas reglas vuelven a `inactive`, `probe_success = 1`.
4. Contenedor de demostración `gymbro-restart-demo` con `restart: on-failure` → `ContainerRestarting` pasa a `firing` cuando `docker_container_restart_count` aumenta.
5. Limpieza: `docker rm -f gymbro-restart-demo gymbro-alert-test` → sin contenedores de prueba.

## Evidencia de pruebas (2026-11-07)

- `pg_up` pasó de 0 → **1** al corregir `POSTGRES_DATA_SOURCE` en el `.env` local (tenía credenciales por defecto del `docker-compose.yml` raíz; el postgres real corre con credenciales de `postgres/.env`).
- `BackendDown`: pasó a `firing` con el backend detenido (probe `probe_success = 0`) y volvió a `inactive` tras `docker start gymbro-backend`.
- `ContainerDown`: pasó a `firing` con el mismo backend detenido.
- `ContainerRestarting`: pasó a `firing` con un contenedor crash-loop; `docker inspect RestartCount = 5` a través de `docker-exporter`.
- CPU usage del VM (panel y alerta) corregidos a `sum by (instance) (rate(...))`.

## Limitaciones técnicas

- **Consultas lentas / `pg_stat_statements`**: no incorporadas. `shared_preload_libraries` está vacío y la extensión no está instalada en el servicio `postgres` (`postgres/compose.yaml`); habilitarla requiere cambiar la configuración del servidor y reiniciar el servicio de postgres, fuera del alcance de este módulo. Sin eso no hay métricas de consultas individuales y **no se afirma** monitoreo de SQL individual: solo `pg_up` y `pg_stat_activity_count` (métricas generales).
- **Replicación**: no aplica, arquitectura single-primary (sin réplica); no hay métricas de replicación.
- **cAdvisor v0.49.1** no expone contadores de reinicios (`container_restart_count` ausente). Por eso existe `docker-exporter`. Si el contenedor crash-loop completa el ciclo entre scrapes, el evento puede no sumar para la alerta.
- **Conflicto de puertos raíz**: `docker-compose.yml` (raíz) y `postgres/compose.yaml` quieren ambos `55433`; el compose raíz no puede levantarse con el postgres del equipo corriendo. El backend quedó levantado manualmente contra la red `gymbro_network` (puerto 3100) para la demo; el equipo debe reconciliar ambos archivos (Gonzalo).
- Las alertas `warning` (CPU/Memoria) usan ventana de `10m`, por lo que pueden tardar en dispararse y auto-resolverse.

## Credenciales

- Grafana: `admin`/`admin` por defecto (override opcional).
- `infra/monitoring/.env` está gitignored; no hay credenciales en texto plano en el repo.
- `.env.example` usa placeholders.
- El password del postgres aparece solo en el `.env` local y en los ejemplos con placeholders.

## Trabajo

Ramas por persona y PR a develop. Consultar docs/ASIGNACION.md y docs/INTEGRACION.md.
