# Módulo infra/n8n — Automatización de Procesos (Punto 13)

Responsable: **Sonia**.

Instancia independiente y segura de **n8n** para orquestar la automatización de procesos e integrar los servicios de la plataforma Gymbro AI (Prometheus, MantisBT, PostgreSQL y Backups).

---

## 1. Arquitectura del servicio

| Parámetro | Valor configurado |
|---|---|
| **Imagen propia** | `n8nio-gymbro/n8n:2.44.6` (n8n 2.44.6 + `psql/pg_dump/pg_restore` **17.11**) |
| **Contenedor** | `gymbro-n8n` |
| **Puertos** | `5678:5678` (host) |
| **Red** | `gymbro-n8n-net` + `host.docker.internal:host-gateway` |
| **Persistencia** | Volumen `n8n_data:/home/node/.n8n` |
| **Informes** | `./informes` → `/data/informes` |
| **Backups (solo lectura)** | `../../postgres/backups` → `/data/pg-backups:ro` (los genera el servicio `gymbro-postgres-backup`; n8n solo verifica) |
| **Configuración segura** | `N8N_ENCRYPTION_KEY` y `RESTORE_TEST_PASSWORD` en `.env` (gitignored) |
| **Zona horaria** | `America/Argentina/Buenos_Aires` |

### Servicios en `compose.yaml`

- **`n8n`** – la instancia principal, accesible en `http://127.0.0.1:5678/`.
- **`pg-restore-test`** – PostgreSQL **17.11** descartable, aislado y con datos en **tmpfs**. Nunca se restaura nada sobre la base principal de Gymbro. `POSTGRES_HOST_AUTH_METHOD` no se usa; la contraseña de `postgres` del sidecar vive en `RESTORE_TEST_PASSWORD` (en `.env`, gitignored). El sidecar **no publica puertos**.

### Imagen personalizada (`Dockerfile`)

La imagen oficial de n8n no incluye cliente/servidor PostgreSQL. Se construye desde `postgres:17-alpine` copiando solo los binarios y dependencias que faltan, incluyendo `pg_dump/pg_restore/psql`/…, la biblioteca `libpq` y la cadena `krb5/ldap` (`LD_LIBRARY_PATH=/usr/local/lib`) para permitir copias de seguridad y restauraciones desde dentro de los nodos.

---

## 2. Puesta en marcha

```powershell
cd infra/n8n

# 1. (si se está reconstruyendo) reconstruir imagen personalizada
docker compose build n8n

# 2. levantar n8n + sidecar pg-restore-test
docker compose up -d

# 3. verificación básica de containers
docker compose ps

# 4. ver logs cuando haga falta
docker compose logs -f n8n
```

---

# 2.5. Sembrar n8n en tu máquina (compañeros)

Objetivo: tras clonar el repo, **un solo comando** deja n8n con las credenciales
compartidas del equipo y los 4 workflows importados y (para WF1/WF2/WF3) activos.

Requisitos previos en TU máquina (igual que en la mía):

1. Docker Desktop corriendo.
2. Stack principal levantado: `docker compose up -d` en la raíz del repo (levanta
   Postgres `gymbro-postgres-primary` y el servicio `gymbro-postgres-backup`,
   que escribe los dumps en `postgres/backups/`). **Necesario para WF2**: sin él,
   el mount read-only de n8n queda vacío y WF2 reportará "sin dumps".
3. Compose de monitoreo levantado (`infra/monitoring`) para WF1/WF3 — opcional.
4. MantisBT levantado (`infra/incidencias`) para WF1 — opcional.
5. Nextcloud levantado (`infra/nextcloud`) para WF3 — opcional.
6. El archivo `.env` que Sonia reparte por privado. **Nunca por git.**

Pasos:

```powershell
cd infra/n8n
# Pegá (o copiá manualmente) el .env que te entregó Sonia como: infra/n8n/.env
.\\sembrar-n8n.ps1                              # Windows
# ./sembrar-n8n.sh                              # Linux / macOS
```

El script:

1. Verifica Docker y que `.env` esté completo (falla ruidoso si falta algo).
2. Genera (si está vacía) una **N8N_ENCRYPTION_KEY propia de TU máquina** y una
   contraseña de administración; ambas quedan en `.env` (gitignored) y no se
   imprimen en consola.
3. `docker compose up -d --build` (reconstruye la imagen si hace falta).
4. Crea el usuario owner de la instancia (`N8N_ADMIN_EMAIL/N8N_ADMIN_PASSWORD`
   del `.env`) en `/rest/owner/setup`. Si ya existe, lo respeta.
5. Importa credenciales con IDs fijos (upsert): MantisBT API Token, Restore Test
   Scratch y, solo si los completás, SMTP.
6. Importa los 4 workflows con **upsert por id**: si ya existían en tu instancia,
   se **actualizan en sitio** al JSON del repo (sin duplicar); si no, se importan.
7. Publica WF1, WF2 y WF3 (los de trigger programado). **WF-RESTORE queda como
   manual: no se publica.**
8. Reinicia el contenedor n8n para que los cambios importados tomen efecto.
9. Verifica conectividad desde dentro del contenedor (Prometheus, MantisBT,
   Nextcloud, Postgres principal, sidecar, analizador IA) e informa qué falla.
   No imprime ningún secreto.

> **Actualizar a una versión nueva de los workflows** (p. ej. el cambio de WF2
> para verificar los backups del servicio `gymbro-postgres-backup` en vez de
> hacer su propio `pg_dump`): no hace falta borrar nada a mano. Alcanza con
> hacer `git pull` y volver a correr el seed (`sembrar-n8n.ps1` / `.sh`) —
> el paso 6 hace upsert sobre el workflow existente y el paso 8 reinicia n8n.
>
> Si preferís hacerlo a mano en la UI: importar el JSON crea un workflow NUEVO
> (los JSON del repo no llevan id), así que primero borrá el workflow viejo
> "WF2 – Verificación de Backups" y después importá `workflows/workflow-2-backups.json`.
> Los JSON del repo NO deben llevar ids de instancias.

> **Gmail**: no forma parte del `.env` compartido. Si querés correos, generá una
> contraseña de aplicación en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
> y agregá `SMTP_HOST/SMTP_PORT/SMTP_SSL/SMTP_USER/SMTP_PASS` a tu `.env` local.
> A la próxima corrida del script, la credencial `SMTP account` queda creada y
> los nodos de email funcionan con tu cuenta.

## 3. Credenciales que SÍ se guardan en el repo

TU MISMO (.env, gitignored):

| Clave `.env` | Valor/uso |
|---|---|
| `N8N_ENCRYPTION_KEY` | Clave de cifrado interna de n8n |
| `RESTORE_TEST_PASSWORD` | Contraseña del usuario `restore_test` del **sidecar de pruebas** |
| `N8N_PORT`, `WEBHOOK_URL`, … | Configuración habitual de n8n |
| `PROMETHEUS_URL`, `MANTIS_URL`, `POSTGRES_*` | Endpoints por defecto (host.docker.internal) |
| ~~`backup.env`~~ (eliminado) | WF2 ya no genera backups: solo verifica los que produce el servicio `gymbro-postgres-backup`. El archivo y su mount `/data/backup-config.env` fueron eliminados |
| `restore-test.env` | Variables libpq para el sidecar (`RESTORE_TEST_HOST/PORT/USER/DB` + `PGPASSWORD`). Montado en solo-lectura en `/data/restore-test-config.env` |
| `local-ca.crt` | Certificado raíz local (Avast Web/Mail Shield intercepta TLS aquí). Montado en solo-lectura en n8n vía `NODE_EXTRA_CA_CERTS`. Gitignored |

`.env.example` trae placeholders, sin secretos.

**Nunca** se guardan contraseñas o tokens en `./workflows/*.json`.

---

## 4. Workflows implementados

### WF1 — Alertas de Infraestructura
Polling cada 30 s a la API de Prometheus, filter de alertas firing, creación/actualización de incidencia en MantisBT con la API token (credencial `MantisBT API Token`). Corre 24/7 en la instancia.

### WF2 — Verificación de Backups (diario 03:00)
Agenda cron (`0 3 * * *`, America/Argentina/Buenos_Aires). Encadena:

WF2 no genera backups: **verifica el resultado** del servicio `gymbro-postgres-backup` (docker-compose.yml raíz, cada 12 h), cuyos dumps aparecen en `/data/pg-backups` (mount read-only de `../../postgres/backups`). Encadena:

1. **Seleccionar Backup Reciente** – lista `/data/pg-backups/smartgymbro_backup_*.dump`, elige el más nuevo y cuenta los dumps fallidos (~0 bytes) que haya dejado el servicio.
2. **Verificar Archivo** – exige que exista, tamaño ≥ 10 MB y antigüedad ≤ 14 h (señal de que el servicio sigue corriendo; los reales pesan ~400 MB).
3. **Verificar Contenido (pg_restore --list)** – exige exit 0 y `objetos > 0`.
4. **¿Backup Válido?** – si algo falla, la rama de error se encarga de registrarlo y notificarlo.
5. **Registrar / Escribir Log** – append a `informes/backup-log.txt` con fecha, archivo, resultado, tamaño, antigüedad, objetos, dumps fallidos detectados y motivo de fallo.
6. **Notificar Error por Email** – envía aviso vía SMTP si falla cualquier etapa (destinatario configurado en la credencial SMTP, ver §7).

### WF-RESTORE — Prueba Controlada de Restauración (manual)
Solo se ejecuta cuando un miembro del equipo hace clic en **Execute Workflow**:

1. **Seleccionar Backup Válido** – busca el dump válido más reciente y ejecuta `pg_restore --list` como filtro previo (nunca como prueba final).
2. **Vaciar Scratch** – borra todos los schemas del scratch `restore_test` (aislado de la base principal) y reconstruye el esquema `public`.
3. **Restaurar Backup** – `pg_restore` dentro de `restore_test`, como prueba controlada.
4. **Contar Tablas** y **Verificar Filas** – cuenta tablas de usuario y filas de cada tabla (verificación real de que los datos volvió cada vez).
5. **Limpiar Scratch (Final)** – siempre deja el scratch vacío.
6. **Registrar Resultado** – append a `informes/restore-test-log.txt` con fecha, archivo, tablas, filas, resultado: `restore_ok` / `restore_fallido`, etapa y error.
7. **Notificar** – en caso de error envía email con mismo patrón que WF2.

### WF3 — Informe de Rendimiento Asistido por IA (semanal)
El flujo sufrió un refuerzo puntual corrida del informe sin entrega automática en Nextcloud cuando no están configuradas las credenciales. Cadena de nodos:

| Nodo | Función |
|---|---|
| Schedule – Lunes 08:00 | Cron semanal (`America/Argentina/Buenos_Aires`) |
| Recolectar Métricas | `wget` a Prometheus (`probe_success`, `probe_duration_seconds`, `docker_container_restart_count`, `node_memory_MemAvailable/Total_bytes`) |
| Analizar con IA Python | POST al analizador Python local con la métrica consolidada; devuelve `anomalies`, `riskLevel` (`OK`/`WARN`/`CRIT`) y `summary` |
| Guardar Informe Local (.md) | Escribe `informes/informe-YYYY-MM-DDTHH-MM-SS.md` |
| ¿Nextcloud Configurado? | Si `NEXTCLOUD_URL` ≠ "" → rama True |
| Subir a Nextcloud (WebDAV) | PUT del `.md` a `${NEXTCLOUD_URL}/SmartGymBro-TP-Final/05-Monitoreo-y-Automatizacion/<archivo>` (Basic Auth `Nextcloud WebDAV (sonia)`) |
| Notificar por Email | Correo al equipo con riesgo + resumen + ruta local del informe (credencial SMTP `SMTP account`) |
| Registrar en Log de Informes | Anexo a `informes/informes-log.txt` |

**Credenciales adicionales para WF3** (se crean en n8n, no se commitean):
- `Nextcloud WebDAV (sonia)` — Basic Auth con usuario/password de Nextcloud
- `SMTP account` — Gmail SMTP usado también por WF2/WF-RESTORE

**Cómo ejecutar puntual del WF3** desde la UI:
1. Abrir el workflow.
2. Botón superior **"Execute workflow"** (gota ►).
3. El informe queda en `informes/`, se sube a Nextcloud si las credenciales existen, llega el email y queda registro en `informes-log.txt`.

---

## 5. Entorno de restauración aislado (`pg-restore-test`)

```powershell
docker compose up -d pg-restore-test
```

Objetivo: un postgres 17.11 descartable, **sin puertos expuestos al host**, con datos solo en tmpfs (se borran al recrear el contenedor). Se usa únicamente como destino de restauración controlada: la base `restore_test` se vacía al inicio y al final de cada prueba.

Ningún flujo restaura dentro de la base principal de Gymbro; todo el trabajo con datos reales ocurre sobre la base `restore_test` dentro de este sidecar.

### Analizador Python (`informe-analyzer`)

Contenedor `python:3.12-alpine` con `informe-analyzer/analyzer.py` (HTTP stdlib en `:8090`, sin dependencias). Punto de entrada para el análisis del WF3; se comunica con el workflow a través de la red privada `gymbro-n8n-net`.

---

## 6. Logs

| Archivo | Contenido |
|---|---|
| `informes/backup-log.txt` | Registro del WF2 (resultado, archivo, gen/verificaciones/error). Ejemplo: `[…] resultado=backup_exitoso | archivo=gymbro-backup-… | gen=OK | contenido=OK(objetos=131) | error=-` |
| `informes/restore-test-log.txt` | Registro del WF-RESTORE. Ejemplo: `restore_ok … tablas=16 | filas=199 | limpieza=OK` |
| `informes/informes-log.txt` | Registro del WF3 (fecha, archivo, riesgo, filepath). Ejemplo: `[…] INFORME: informe-2026-11-09T17-37-01.md | riesgo=OK | anomalias=0 | estado=generado_local` |
| `informes/*.md` | Informes generados por WF3 (uno por corrida) |

---

## 7. Credenciales de n8n y pasos manuales pendientes

| Credencial | Tipo | Estado de configuración |
|---|---|---|
| **Prometheus Webhook Token** | httpHeaderAuth | Configurada |
| **MantisBT API Token** | httpHeaderAuth | Configurada |
| **Restore Test Scratch** | Postgres | Configurada (host `pg-restore-test:5432`, db/user `restore_test`) |
| **SMTP account** | smtp | Configurada (Gmail SMTP, SSL/TLS 465) |
| **Gmail SMTP (cambiar password)** | smtp | Creada con password placeholder (vacío). Reemplazada por `SMTP account` en los 3 workflows. |
| **Nextcloud WebDAV (sonia)** | httpBasicAuth | Configurada (carpeta `SmartGymBro-TP-Final/05-Monitoreo-y-Automatizacion/`) |

### SMTP de Gmail (paso manual)

1. En n8n → **Settings → Credentials → New → SMTP** (tipo `smtp`).
2. Editá **Gmail SMTP (cambiar password)**: Host `smtp.gmail.com`, Port `465`, **SSL/TLS ON**, User `gsoniaemiliana@gmail.com`, Password = **contraseña de aplicación** generada en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (requiere 2FA en la cuenta).
3. Guardá.
4. En WF2 y WF-RESTORE: nodo **Notificar Error por Email** → Asigná la credencial editada. Listo.

> **Nota:** desde esta máquina n8n no puede completar el handshake TLS con `smtp.gmail.com:465` (`self-signed certificate in certificate chain`). Es un problema del host (proxy/certificado corporativo local), no del workflow: el flujo llegó correctamente al nodo y el envío se intentó. Al completar la credencial y/o usar un SMTP corporativo válido, el mismo nodo envía el correo.

---

## 8. Pruebas realizadas (y evidencia)

| # | Prueba | Cómo se ejecutó | Resultado |
|---|---|---|---|
| 1 | **Backup exitoso** | Corrida puntual (workflow de test temporal de 1 min, después eliminado) del flujo WF2 | `backup_exitoso` en el log; dump `gymbro-backup-…dump` de **72 366 bytes, 131 objetos** |
| 2 | **Backup fallido controlado** | Cambio del host de pg_dump para apuntar a una base inexistente → rama de error completa | Log: `backup_fallido` con `gen=FALLO` / `contenido=FALLO`. La rama llega correctamente al nodo **email**. |
| 3 | **Restauración controlada (éxito)** | Corrida manual / puntual | `tablas=16`, `filas=199`, `limpieza=OK`, log `restore_ok` |
| 4 | **Restauración controlada (fallo controlado)** | Forzado de l flujo al `stage=restaurar` con `pg_restore` sobre un dump inválido | Log `restore_fallido`, `etapa=restaurar`, motivo visible |

---

## 9. Restricciones respectadas (Seguridad y Git)

- Sin contraseñas en `.git/…` ni en `./workflows/*.json`: cifradas en n8n (SMTP, Postgres) o en `.env`/`backup-env` locales (gitignored).
- No se toca la base principal (`gymbro-postgres-primary`); las restauraciones nunca se hacen sobre ella.
- No hay puertos publicados por el sidecar (solo en la red privada del compose).
- No hay volúmenes compartidos entre el sidecar y la principal.
- No se commitean backups (`backups/*.dump` en `.gitignore`).
- No se modificaron `infra/monitoring/`, `infra/incidencias/` u otros compañeros; `feature/n8n` sin `git add/commit/push/merge/PR`.
- No quedaron workflows ni nodos de prueba activos; sólo WF1, WF2 y WF-RESTORE activos/activables.

---

## 10. Lista de verificación de entregables (Punto 13)

- [x] n8n desplegado con persistencia (volumen `n8n_data`)
- [x] Workflows: 3 × (2 automáticos + 1 manual), ≥3 integraciones (Prometheus, MantisBT, PostgreSQL/Backups)
- [x] Manejo de errores: rama completa de fallo en WF2 y WF-RESTORE con registro + email
- [x] Logs persistentes en disco (`backup-log.txt`, `restore-test-log.txt`)
- [x] Prueba de restauración controlada (aislada)
- [x] Sin secretos en la repo
- [ ] SMTP Gmail configurado con contraseña de aplicación (pendiente manual de Sonia)

