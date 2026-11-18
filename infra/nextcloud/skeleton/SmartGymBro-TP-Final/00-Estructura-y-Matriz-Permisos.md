# Punto 12 — Gestión Documental con Nextcloud (`SmartGymBro`)

Este repositorio documental centraliza toda la documentación técnica, informes de pruebas, configuraciones y evidencias de la **Práctica Integradora Final 2026 — SmartGymBro**.

---

## 1. Estructura Documental Oficial

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

## 2. Matriz de Permisos y Control de Acceso (RBAC)

El acceso a la instancia Nextcloud (`http://localhost:8081`) está restringido exclusivamente a los **5 integrantes autorizados del equipo**, organizados en grupos de rol mediante aprovisionamiento automático (`occ`):

| Usuario | Nombre y Rol | Grupo de Rol en Nextcloud | `01-Arquitectura` | `02-Base-Datos` | `03-Docker-CI-CD` | `04-Seguridad` | `05-Monitoreo` | `06-Entregables` |
|---|---|---|---|---|---|---|---|---|
| `gonzalo` | **Gonzalo** (Project Lead / Admin) | `admin`, `Rol-Admin-Arquitectura`, `SmartGymBro-Equipo` | **R/W/Admin** | **R/W/Admin** | **R/W/Admin** | **R/W/Admin** | **R/W/Admin** | **R/W/Admin** |
| `facundo` | **Facundo** (DBA / PostgreSQL) | `Rol-DBA-Datos`, `SmartGymBro-Equipo` | Lectura (`R`) | **Lectura/Escritura (`R/W`)** | Lectura (`R`) | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** |
| `aldo` | **Aldo** (DevOps / CI-CD / Docker) | `Rol-DevOps-CI-CD`, `SmartGymBro-Equipo` | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** |
| `rodrigo` | **Rodrigo** (SecOps / MantisBT) | `Rol-SecOps-Calidad`, `SmartGymBro-Equipo` | Lectura (`R`) | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** | Lectura (`R`) | **Lectura/Escritura (`R/W`)** |
| `sonia` | **Sonia** (SRE / Monitoreo / n8n) | `Rol-Observabilidad-SRE`, `SmartGymBro-Equipo` | Lectura (`R`) | Lectura (`R`) | Lectura (`R`) | Lectura (`R`) | **Lectura/Escritura (`R/W`)** | **Lectura/Escritura (`R/W`)** |
| *Anónimo / Externo* | Usuarios no autenticados | *Ninguno* | **Denegado** | **Denegado** | **Denegado** | **Denegado** | **Denegado** | **Denegado** |

---

## 3. Políticas de Seguridad Aplicadas en Nextcloud

1. **Acceso exclusivo a usuarios autorizados:** El registro público está deshabilitado y la compartición está restringida a miembros autenticados de los grupos del proyecto (`shareapi_only_share_with_group_members = yes`).
2. **Protección de secretos:** Ningún archivo `.env`, clave privada (`.pem`, `.key`) ni credencial en texto plano se almacena en el repositorio documental; solo se documentan plantillas `.env.example` y referencias a GitHub Secrets / variables de entorno inyectadas.
3. **Control de versiones de entregables:** La aplicación nativa `files_versions` está activa para conservar el historial de revisiones de cada informe subido.
