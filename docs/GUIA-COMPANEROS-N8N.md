# Guía de compañeros — desplegar y probar n8n localmente

Objetivo: en **tu propia computadora** ves los 4 workflows del proyecto
(WF1 Alertas, WF2 Backups, WF3 Informe IA, WF-RESTORE) ejecutándose en tu
`http://localhost:5678`, con una instancia de n8n tuya (propia clave de cifrado,
propio owner) y las credenciales compartidas del equipo.

> **Nunca subir a git** el `.env` real. Sonia te lo entrega por privado (mail,
> USB, chat privado…). El repo solo trae `.env.example` con placeholders.

---

## 0. Qué vas a necesitar antes de empezar

| Prerequisito | Para qué | Comando / nota |
|---|---|---|
| Docker Desktop (o Docker Engine + Compose v2 en Linux) | Contenedores | `docker version` |
| Repo clonado (Rama `feature/n8n` o `develop` según indicación) | Todo | `git clone …` |
| Stack principal: `docker compose up -d` en la raíz del repo | Postgres + pgAdmin (WF2) | http://localhost:5050 |
| Monitoreo (WF1/WF3) | Prometheus :9090 | `cd infra/monitoring && docker compose up -d` |
| Incidencias (WF1) | MantisBT :8089 | `cd infra/incidencias && docker compose up -d` |
| Nextcloud (WF3) | WebDAV `:8081` | `cd infra/nextcloud && docker compose up -d` |
| **El archivo `.env` que te entrega Sonia** | Credenciales compartidas | ver §1 |

Los tres servicios opcionales (Monitoreo / Incidencias / Nextcloud) pueden ser
salteados: n8n levanta igualmente, los workflows importan igualmente y los que
no encuentren su servicio mostrarán errores por nodo sin afectar a los demás.

## 1. El archivo que te comparte Sonia (NO se commitea)

Es un único **`infra/n8n/.env`** relleno con los valores compartidos del equipo:

- `MANTIS_URL` y `MANTIS_API_TOKEN` (WF1)
- `NEXTCLOUD_URL`, `NEXTCLOUD_USER`, `NEXTCLOUD_PASSWORD` (WF3)
- `PROMETHEUS_URL` (WF1 y WF3)
- `POSTGRES_HOST/PORT/USER/DB/PASSWORD` (WF2)
- `RESTORE_TEST_PASSWORD` (sidecar WF-RESTORE) — o vacío para generarlo local
- `MANTIS_API_TOKEN`: un token creado en MantisBT → Administración → API tokens,
  para el usuario con el que se integra MantisBT.

**No incluye:**

| Variable | Por qué |
|---|---|
| `N8N_ENCRYPTION_KEY` | Es privada de tu máquina; si va vacía, el seed la genera y la guarda en tu `.env` (gitignored). |
| `N8N_ADMIN_EMAIL/PASSWORD` | Opcionales; si van vacías el seed crea `admin@gymbro.tp` + contraseña generada (queda solo en tu `.env`, no se imprime). |
| `SMTP_*` / Gmail | Se deja a tu criterio. Ver §5 "SMTP opcional (Gmail)". |

## 2. Despliegue — Windows

```powershell
cd C:\...\tp-Final-Gymbro\infra\n8n
copy "C:\ruta\donde\te\lo\pasaron\.env" .env
.\sembrar-n8n.ps1
```

## 3. Despliegue — Linux / macOS

```bash
cd /ruta/tp-Final-Gymbro/infra/n8n
cp "/ruta/donde/te/lo/pasaron/.env" .env
chmod +x sembrar-n8n.sh
./sembrar-n8n.sh
```

## 4. Qué hace el script y qué vas a ver

1. Verifica Docker y Compose.
2. Lee tu `.env` y **comprueba** que están los valores compartidos obligatorios
   (`MANTIS_URL`, `MANTIS_API_TOKEN`, `NEXTCLOUD_*`, `PROMETHEUS_URL`,
   `POSTGRES_PASSWORD`, `RESTORE_TEST_PASSWORD`). Si falta alguno, se detiene y
   te dice cuál.
3. Genera (si está vacía) `N8N_ENCRYPTION_KEY` y admin local (`N8N_ADMIN_*`).
4. `docker compose up -d --build` → levanta n8n + `pg-restore-test`
   + `informe-analyzer`.
5. Espera a que n8n responda en `http://localhost:5678`.
6. Crea el owner local (`POST /rest/owner/setup`). Si ya existe, lo respeta.
7. Importa/actualiza credenciales en tu instancia (upsert por id):
   `MantisBT API Token`, `Restore Test Scratch`. SMTP se crea solo si vos
   completaste `SMTP_*`.
8. Importa los workflows que falten y publica WF1, WF2 y WF3.
   **WF-RESTORE es manual y no se publica.**
9. Imprime un checklist de conectividad (Prometheus, MantisBT, Nextcloud,
   Postgres principal, analizador IA, sidecar de restauración) desde dentro del
   contenedor. No imprime secretos.
10. **Borra** los archivos temporales con datos sensibles (`.seed/` queda
    vacío).

Vas a ver los 4 workflows en **Workflows** del panel n8n y empezar a correr:

| Workflow | Trigger | Estado esperado |
|---|---|---|
| WF1 – Alertas de Infraestructura | cada 30 s | **Activo** |
| WF2 – Verificación de Backups | diario 03:00 | **Activo** |
| WF3 – Informe de Rendimiento IA | lunes 08:00 | **Activo** |
| WF-RESTORE – Prueba Controlada de Restauración | manual | **Importado, no publicado** |

> El workflow WF-RESTORE siempre se corre a mano (botón **Execute workflow**),
> limpia el scratch al final y nunca toca la base principal.
> Si no querés que corra ni una vez, ni siquiera lo verás disparar.

## 5. SMTP opcional (Gmail)

Gmail no está en el `.env` compartido por decisión del TP. Para recibir emails
en **tu instancia**:

1. Activa 2FA en tu cuenta Google.
2. [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   → App: "Correo" o nombre personalizado → crear contraseña.
3. Agregar en tu `.env` local:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SSL=true
   SMTP_USER=tucorreo@gmail.com
   SMTP_PASS=<la contraseña de aplicación de 16 caracteres>
   ```

4. Volver a correr `sembrar-n8n.ps1` / `sembrar-n8n.sh` (creará la credencial
   `SMTP account` que los nodos de email ya referencian) o crear la credencial
   a mano en n8n (Settings → Credentials → **SMTP**).

## 6. Si algo falla

| Síntoma | Causa probable | Acción |
|---|---|---|
| `Falta o está vacía la variable …` | El `.env` llegó incompleto | Pedile a Sonia el archivo completo |
| `docker: command not found` | Docker no instalado | Instalar Docker Desktop / Engine |
| La UI no carga en :5678 | Puerto ocupado o stack aún levantando | `docker compose logs -f n8n`; cambiar `N8N_PORT` en `.env` si el 5678 está en uso |
| WF1 no crea issues | MantisBT caído o token inválido | `curl -H "Authorization: Bearer $MANTIS_API_TOKEN" http://host.docker.internal:8089/api/rest/issues?page_size=1` |
| WF2 falla en `pg_dump` | Contenedor principal Postgres caído o `POSTGRES_PASSWORD` errada | `docker exec gymbro-postgres pg_isready` |
| WF3 no sube a Nextcloud | `NEXTCLOUD_URL/USER/PASSWORD` desactualizados | Re-copiar esos 3 valores al `.env` y re-correr el seed |
| `n8n está vivo` tarda demasiado / crash-loop `Task Broker's port 5679 is already in use` | Elegiste 5679 (Task Broker por defecto) o el stack sigue levantando | Cambiá `N8N_PORT` en tu `.env` al puerto HTTP deseado (5678 u otro libre) y volvé a correr el seed. Evitar 5679 siempre. |
| n8n abre pero no está el owner / pide registro | El paso `owner/setup` falló (poco frecuente) | Borrar y re-crear el contenedor con volumen vacío y reintentar |

## 7. Para Sonia (generar el archivo que se comparte)

Checklist desde **mi** máquina de desarrollo:

1. Crear el archivo `infra/n8n/.env` para entregar — **una copia**, no editar el
   mío de trabajo.

2. Completar los valores que los otros compañeros comparten:

   ```
   MANTIS_URL=http://host.docker.internal:8089      # o el que corresponda
   MANTIS_API_TOKEN=<token que generás en MantisBT como administrator>
   PROMETHEUS_URL=http://host.docker.internal:9090
   NEXTCLOUD_URL=http://host.docker.internal:8081/remote.php/dav/files/sonia
   NEXTCLOUD_USER=sonia
   NEXTCLOUD_PASSWORD=<el de Nextcloud>
   POSTGRES_HOST=host.docker.internal
   POSTGRES_PORT=55433
   POSTGRES_USER=smartgymbro_tp
   POSTGRES_DB=smartgymbro_tp
   POSTGRES_PASSWORD=<la de postgres/.env del repo>
   RESTORE_TEST_PASSWORD=<dejá vacío si querés que cada uno genere el suyo>
   ```

3. **NO incluir** `N8N_ENCRYPTION_KEY` propia de mi n8n; **NO incluir** mis
   credenciales SMTP de Gmail; **NO incluir** contraseñas del pgAdmin.
4. Enviarla por privado (nunca por el repo/chat de equipo público).
5. Cuando alguien la use por primera vez, avisarle que:
   - `http://localhost:5678` ya no es mi instancia: cada uno tiene la suya;
   - el owner de n8n lo crea el seed (si no, abrir la UI una vez y completar el
     formulario y luego re-ejecutar el seed para los workflows).

## 8. Evidencia y checklist para el Punto 13

Tras correr el seed, el owner puede validar:

- [ ] `http://localhost:5678` responde.
- [ ] **Workflows** muestra los 4.
- [ ] WF1 y WF2 y WF3 muestran **Active**.
- [ ] **Settings → Credentials** muestra sin duplicados: `MantisBT API Token`,
      `Restore Test Scratch` (y `SMTP account` si configuraste Gmail).
- [ ] La página de ejecuciones de WF2 registra al menos un backup diario.
- [ ] Informes en `infra/n8n/informes/` aparecen (al menos uno manual de WF3).
- [ ] Nunca cumplir con `git add` del `.env` ni de `.seed/`.
