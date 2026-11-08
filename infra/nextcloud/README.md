# Punto 12 — Gestión Documental con Nextcloud (`infra/nextcloud`)

- **Responsable:** Gonzalo (`GonzaloAPU`)
- **URL Local / Remota:** `http://localhost:8081` / `http://100.121.22.101:8081` (Tailscale)
- **Imagen Docker:** `nextcloud:29-apache`
- **Arquitectura de Persistencia:** *Configuration as Code* mediante Hooks oficiales (`post-installation` con `php occ`) y volumen interno de Docker (`nextcloud_data`), evitando subir volúmenes pesados o bases de datos a GitHub.

---

## 1. Cumplimiento de las 8 Actividades de la Consigna

| # | Actividad solicitada | Implementación en SmartGymBro |
|---|---|---|
| **1** | Desplegar Nextcloud o utilizar una instancia autorizada | Contenedor `gymbro-nextcloud` en puerto `8081` integrado en [`docker-compose.yml`](../../docker-compose.yml) y [`infra/nextcloud/compose.yaml`](./compose.yaml). |
| **2** | Crear una estructura de carpetas | Árbol documental estandarizado `SmartGymBro-TP-Final/` con 6 subdirectorios temáticos precargados desde [`skeleton/`](./skeleton/SmartGymBro-TP-Final/). |
| **3** | Definir permisos de acceso | Grupos RBAC creados automáticamente (`Rol-Admin-Arquitectura`, `Rol-DBA-Datos`, `Rol-DevOps-CI-CD`, `Rol-SecOps-Calidad`, `Rol-Observabilidad-SRE` y `SmartGymBro-Equipo`). |
| **4** | Almacenar la documentación del proyecto | Sincronización automática de `docs/` del repositorio hacia las carpetas temáticas durante el hook de inicialización. |
| **5** | Centralizar informes de pruebas, configuraciones y reportes | Incluye informes de monitoreo Prometheus/Grafana, matriz de amenazas MantisBT, esquema SQL en español y plan de Rollback. |
| **6** | Registrar las versiones relevantes de los entregables | App nativa `files_versions` habilitada + registro formal en [`CONTROL-DE-VERSIONES-ENTREGABLES.md`](./skeleton/SmartGymBro-TP-Final/06-Registro-Versiones-Entregables/CONTROL-DE-VERSIONES-ENTREGABLES.md). |
| **7** | Evitar almacenar secretos sin protección | Ningún volumen de datos ni archivo `.env` se sube a Git; normativa documentada en [`POLITICA-PROTECCION-SECRETOS.md`](./skeleton/SmartGymBro-TP-Final/04-Seguridad-e-Incidencias/POLITICA-PROTECCION-SECRETOS.md). |
| **8** | Verificar el acceso únicamente a los usuarios autorizados | Creación exclusiva de las 5 cuentas del equipo (`gonzalo`, `facundo`, `aldo`, `rodrigo`, `sonia`), subida pública deshabilitada (`shareapi_allow_public_upload=no`) y compartición restringida al grupo (`shareapi_only_share_with_group_members=yes`). |

---

## 2. Entregable 1: Estructura Documental

```text
SmartGymBro-TP-Final/
├── 00-Estructura-y-Matriz-Permisos.md
├── 01-Arquitectura-y-Gestion-Agil/
│   ├── ASIGNACION.md
│   ├── BIENVENIDA.md
│   ├── CRONOGRAMA.md
│   ├── FLUJO-GIT.md
│   └── INTEGRACION.md
├── 02-Base-de-Datos-y-Replicacion/
│   ├── DIAGRAMA-BASE-DE-DATOS-ES.md
│   ├── DIAGRAMA-BASE-DE-DATOS.md
│   ├── MARCAS-PERSONALES.md
│   └── NOMBRES-BASE-ESPANOL.md
├── 03-Docker-CI-CD-y-Rollback/
│   ├── ANGULAR-22.md
│   ├── CONFIGURACION-GITHUB.md
│   ├── ROLLBACK.md
│   └── VALIDACION-INICIAL.md
├── 04-Seguridad-e-Incidencias/
│   ├── MATRIZ-AMENAZAS-MANTIS.md
│   ├── POLITICA-PROTECCION-SECRETOS.md
│   └── SEGURIDAD-2026-10-26.md
├── 05-Monitoreo-y-Automatizacion/
│   └── INFORME-MONITOREO-GRAFANA-PROMETHEUS.md
└── 06-Registro-Versiones-Entregables/
    └── CONTROL-DE-VERSIONES-ENTREGABLES.md
```

---

## 3. Entregable 2: Matriz de Permisos (RBAC)

| Usuario | Rol en el Equipo | Grupos Asignados | `01-Arquitectura` | `02-Base-Datos` | `03-Docker-CI-CD` | `04-Seguridad` | `05-Monitoreo` | `06-Entregables` |
|---|---|---|---|---|---|---|---|---|
| `gonzalo` | Project Lead & Arquitectura | `admin`, `Rol-Admin-Arquitectura`, `SmartGymBro-Equipo` | **R/W/Admin** | **R/W/Admin** | **R/W/Admin** | **R/W/Admin** | **R/W/Admin** | **R/W/Admin** |
| `facundo` | DBA & PostgreSQL 17 | `Rol-DBA-Datos`, `SmartGymBro-Equipo` | Lectura (`R`) | **Lectura/Escritura (`R/W`)** | Lectura (`R`) | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** |
| `aldo` | DevOps, Docker & CI/CD | `Rol-DevOps-CI-CD`, `SmartGymBro-Equipo` | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** |
| `rodrigo` | SecOps & MantisBT | `Rol-SecOps-Calidad`, `SmartGymBro-Equipo` | Lectura (`R`) | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** | Lectura (`R`) | **Lectura/Escritura (`R/W`)** |
| `sonia` | SRE, Monitoreo & n8n | `Rol-Observabilidad-SRE`, `SmartGymBro-Equipo` | Lectura (`R`) | Lectura (`R`) | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** | **Lectura/Escritura (`R/W`)** |
| *No autenticado* | Externo | *Ninguno* | **Denegado** | **Denegado** | **Denegado** | **Denegado** | **Denegado** | **Denegado** |

### Credenciales iniciales de prueba (Generadas por `01-setup-smartgymbro.sh`)
- **Cuenta de sistema:** `admin` / `smartgymbro_tp`
- **Cuentas nominadas del equipo (`gonzalo`, `facundo`, `aldo`, `rodrigo`, `sonia`):** contraseña inicial `SmartGym2026!` (configurable mediante la variable de entorno `NEXTCLOUD_TEAM_PASSWORD`).

---

## 4. Despliegue y Verificación (Evidencias)

```bash
# 1. Levantar Nextcloud desde el docker-compose.yml de la raíz
docker compose up -d nextcloud

# 2. Verificar la ejecución del hook de aprovisionamiento
docker logs gymbro-nextcloud

# 3. Verificar usuarios y grupos autorizados mediante occ
docker exec -u www-data gymbro-nextcloud php occ user:list
docker exec -u www-data gymbro-nextcloud php occ group:list
```
