#!/usr/bin/env bash
# Siembra completa de n8n para una instalación nueva de Gymbro.
#
# Pensado para que cada integrante copie este módulo, coloque el .env que
# Sonia comparte y ejecute UN solo comando:
#
#     ./sembrar-n8n.sh
#
# Hace, en orden:
#   1. Verifica docker / docker compose.
#   2. Crea (si falta) una N8N_ENCRYPTION_KEY propia y la guarda en .env.
#   3. Crea/refresca las credenciales necesarias (idempotente: upsert por id).
#   4. Importa los workflows faltantes.
#   5. Publica (activa) los workflows con trigger programado: WF1, WF2, WF3.
#      El WF-RESTORE es de ejecución manual y NO se publica.
#   6. Verifica conectividad interna y externa SIN imprimir secretos.
#
# Ningún token/contraseña se imprime en consola ni queda en archivos
# temporales legibles. .seed/ es gitignored.

set -euo pipefail

N8N_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$N8N_DIR"

ENV_FILE="${1:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  echo "Copia el .env que recibiste de Sonia (o créalo desde .env.example) e inténtalo de nuevo." >&2
  exit 1
fi
ENV_FILE="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"
COMPOSE_FILE="${2:-compose.yaml}"

STEP() { printf '\n==> %s\n' "$1"; }
OK()   { printf '    OK    %s\n' "$1"; }
WARN() { printf '    AVISO %s\n' "$1"; }
FAIL() { printf '    FALLO %s\n' "$1" >&2; }

# --------------------------------------------------------------- env helpers
get_env() {
  local key="$1" default="${2:-}" val
  val="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  if [ -z "$val" ]; then echo "$default"; else echo "$val"; fi
}

set_env() {
  local key="$1" value="$2"
  if grep -qE "^[[:space:]]*${key}=" "$ENV_FILE"; then
    local tmp
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" '
      $0 ~ "^[[:space:]]*" k "=" { print k "=" v; next }
      { print }
    ' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$(( ${1:-24} ))"
  else
    head -c "$(( ${1:-24} ))" /dev/urandom | base64 | tr -d '+/=' | cut -c1-32
  fi
}

STEP 'Verificando prerequisitos'
if ! command -v docker >/dev/null 2>&1; then
  FAIL "No se encontró 'docker'. Instala Docker y vuelve a intentarlo."; exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  FAIL 'Docker Compose v2 no está disponible.'; exit 1
fi

STEP "Verificando $ENV_FILE"
POSTGRES_PASSWORD="$(get_env POSTGRES_PASSWORD)"
MANTIS_URL="$(get_env MANTIS_URL)"
MANTIS_API_TOKEN="$(get_env MANTIS_API_TOKEN)"
NEXTCLOUD_URL="$(get_env NEXTCLOUD_URL)"
NEXTCLOUD_USER="$(get_env NEXTCLOUD_USER)"
NEXTCLOUD_PASSWORD="$(get_env NEXTCLOUD_PASSWORD)"
PROMETHEUS_URL="$(get_env PROMETHEUS_URL)"
RESTORE_TEST_PASSWORD="$(get_env RESTORE_TEST_PASSWORD)"

MISSING=0
for v in POSTGRES_PASSWORD MANTIS_URL MANTIS_API_TOKEN NEXTCLOUD_URL NEXTCLOUD_USER NEXTCLOUD_PASSWORD PROMETHEUS_URL RESTORE_TEST_PASSWORD; do
  if [ -z "${!v}" ]; then
    FAIL "Falta o está vacía la variable $v en el .env. Revisá/pídele el archivo completo a Sonia."
    MISSING=1
  fi
done
[ "$MISSING" -eq 0 ] || exit 1

N8N_ENCRYPTION_KEY="$(get_env N8N_ENCRYPTION_KEY)"
if [ -z "$N8N_ENCRYPTION_KEY" ]; then
  N8N_ENCRYPTION_KEY="$(random_secret 24)"
  set_env N8N_ENCRYPTION_KEY "$N8N_ENCRYPTION_KEY"
  OK 'Se generó una N8N_ENCRYPTION_KEY propia para esta máquina y quedó en el .env.'
else
  OK 'N8N_ENCRYPTION_KEY presente (se conserva).'
fi

if [ -z "$RESTORE_TEST_PASSWORD" ]; then
  RESTORE_TEST_PASSWORD="$(random_secret 18)"
  set_env RESTORE_TEST_PASSWORD "$RESTORE_TEST_PASSWORD"
  OK 'Se generó una RESTORE_TEST_PASSWORD propia y quedó en el .env.'
fi

N8N_ADMIN_EMAIL="$(get_env N8N_ADMIN_EMAIL)"
if [ -z "$N8N_ADMIN_EMAIL" ]; then
  N8N_ADMIN_EMAIL='admin@gymbro.tp'
  set_env N8N_ADMIN_EMAIL "$N8N_ADMIN_EMAIL"
  OK "N8N_ADMIN_EMAIL=$N8N_ADMIN_EMAIL (editable en .env)."
fi
N8N_ADMIN_PASSWORD="$(get_env N8N_ADMIN_PASSWORD)"
if [ -z "$N8N_ADMIN_PASSWORD" ]; then
  N8N_ADMIN_PASSWORD="$(random_secret 12)Aa1"
  set_env N8N_ADMIN_PASSWORD "$N8N_ADMIN_PASSWORD"
  OK 'Se generó N8N_ADMIN_PASSWORD y quedó en el .env (no se imprime).'
fi
N8N_ADMIN_FIRSTNAME="$(get_env N8N_ADMIN_FIRSTNAME)"
if [ -z "$N8N_ADMIN_FIRSTNAME" ]; then
  N8N_ADMIN_FIRSTNAME='Gymbro'
  set_env N8N_ADMIN_FIRSTNAME "$N8N_ADMIN_FIRSTNAME"
fi
N8N_ADMIN_LASTNAME="$(get_env N8N_ADMIN_LASTNAME)"
if [ -z "$N8N_ADMIN_LASTNAME" ]; then N8N_ADMIN_LASTNAME='Admin'; set_env N8N_ADMIN_LASTNAME "$N8N_ADMIN_LASTNAME"; fi

STEP 'Preparando archivos auxiliares (.gitignore) que usa el compose'

# WF2 ya no genera backups (los genera el servicio gymbro-postgres-backup y
# n8n solo los verifica montando ../../postgres/backups en solo lectura).
# backup.env ya no se usa: no se genera.
if [ ! -d "$N8N_DIR/../../postgres/backups" ]; then
  WARN 'No existe ../../postgres/backups: montá primero el stack raíz (docker-compose.yml) para que el servicio de backups cree los dumps; si falta, Docker la creará vacía y WF2 reportará "sin dumps".'
fi

if [ -f "$N8N_DIR/restore-test.env" ]; then
  OK 'restore-test.env ya existe; se conserva.'
else
  cat > "$N8N_DIR/restore-test.env" <<EOF
RESTORE_TEST_HOST=pg-restore-test
RESTORE_TEST_PORT=5432
RESTORE_TEST_USER=restore_test
RESTORE_TEST_DB=restore_test
PGPASSWORD=$RESTORE_TEST_PASSWORD
EOF
  OK 'restore-test.env generado (gitignored).'
fi

if [ -f "$N8N_DIR/local-ca.crt" ]; then
  OK 'local-ca.crt ya existe; se conserva.'
else
  # Placeholder PÚBLICO de desarrollo (certificado de juguete, no otorga
  # confianza sobre nada más). Si en tu red hay un CA proxy (Zscaler, Avast…),
  # reemplázalo por el certificado raíz real de esa CA.
  cat > "$N8N_DIR/local-ca.crt" <<'EOF'
-----BEGIN CERTIFICATE-----
MIIDOjCCAiKgAwIBAgIQHu22WqbTQq9A0urqWz2MzTANBgkqhkiG9w0BAQsFADAvMS0wKwYDVQQD
DCRHeW1icm8gTG9jYWwgRGV2ZWxvcG1lbnQgUGxhY2Vob2xkZXIwIBcNMjYxMTEwMDYxMTMxWhgP
MjA1NjExMTAwNjIxMzBaMC8xLTArBgNVBAMMJEd5bWJybyBMb2NhbCBEZXZlbG9wbWVudCBQbGFj
ZWhvbGRlcjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAN4FGK8EXq4kwzCr8BPTIYfV
85bqX3OSJh9+hHb1hy1D09JN21ZE79sgV22gbOzD8IAj++DNRr/OTsTAWMZdM9GlK91tKO07Y6oU
PgVq/CV5ntNvkYVGYuGPWI7DLfM1YTbOa0rR/HNoixGFTH3fmj4PkrM6DQtAjeeNZy5hNChZMIzl
EP82TAr8W4+clv69xppJ+nvylYw9TpWD4T4vMTEectRf3Bf0K38oTdj4f//9nU0Nhbxto5NZ0pB6
sJy1qWM1Al3KujBobEDb9b9Gpi/0FQJnUR8mTmPoGKKMju84fTYTSbY+uDGsyX/1IeodBbEMap/w
iErnaWH2xOK7zg0CAwEAAaNQME4wDgYDVR0PAQH/BAQDAgGGMB0GA1UdJQQWMBQGCCsGAQUFBwMC
BggrBgEFBQcDATAdBgNVHQ4EFgQU6xm6zSuFmmctOwemG738BIwh2YgwDQYJKoZIhvcNAQELBQAD
ggEBAA9OZMmZzIzdvMRWfdlmtpHryeaXJtzLOyzxa9owvx3VPR45ihp+izssI8yAQ1qtoCvIqagA
eIPT/Sm/PiRZ5V3WhaJg8ckzsGDzNrnm1oWMqT5s/oCMpjrZGT2YtcH5xhMQ8ihPbMEwoFHVs4ik
oWYIngLEXlqsvsqUjhe6HMB0ChjODoPzYkeF1CRpaFVUR4G8JxCJRac2CkHSvBx6IM4UIkaHgSXU
8Jri2taIXI6pnlI+FEXR+zjeHAqW7b19eF260jPNv5WMqssauf7YX0WnleZWBZw2nSXzvMOYUaCg
MvmwlTzDdBd6yW8AqO0VE23PjqZekhFtyr2kD25PI+g=
-----END CERTIFICATE-----
EOF
  OK 'local-ca.crt generado (placeholder de desarrollo). Reemplázalo por la CA de tu red si aplica.'
fi

STEP 'Preparando carpeta de trabajo (.seed/, gitignored)'
SEED_DIR="$N8N_DIR/.seed"
mkdir -p "$SEED_DIR"

STEP 'Levantando el stack n8n (build + up -d)'
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
CID="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q n8n | head -n1)"
if [ -z "$CID" ]; then
  FAIL 'No se pudo obtener el container id del servicio n8n.'; exit 1
fi
OK "Contenedor n8n: $CID"

N8N_PORT="$(get_env N8N_PORT 5678)"
BASE_URL="http://localhost:${N8N_PORT}"
STEP "Esperando que n8n responda en ${BASE_URL} ..."
DEADLINE=$(( $(date +%s) + 180 ))
READY=0
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/healthz" || true)"
  case "$CODE" in
    2*|3*) READY=1; break ;;
  esac
  sleep 3
done
if [ "$READY" -eq 1 ]; then
  OK 'n8n está vivo.'
else
  FAIL 'n8n no respondió en /healthz tras 3 minutos. Últimas líneas de log:'
  docker logs --tail 40 "$CID"
  exit 1
fi

STEP 'Creando usuario owner de n8n (una sola vez, idempotente)'
OWNER_BODY=$(E="$N8N_ADMIN_EMAIL" F="$N8N_ADMIN_FIRSTNAME" L="$N8N_ADMIN_LASTNAME" P="$N8N_ADMIN_PASSWORD" \
  node -e "process.stdout.write(JSON.stringify({email:process.env.E,firstName:process.env.F,lastName:process.env.L,password:process.env.P}))" 2>/dev/null || true)
if [ -z "$OWNER_BODY" ]; then
  # Fallback sin node local: construcción segura vía python3 o sed escaping
  esc() { printf '%s' "$1" | sed -e 's/\\\\/\\\\\\\\/g' -e 's/"/\\"/g'; }
  OWNER_BODY=$(printf '{"email":"%s","firstName":"%s","lastName":"%s","password":"%s"}' \
    "$(esc "$N8N_ADMIN_EMAIL")" "$(esc "$N8N_ADMIN_FIRSTNAME")" "$(esc "$N8N_ADMIN_LASTNAME")" "$(esc "$N8N_ADMIN_PASSWORD")")
fi
RESP="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}/rest/owner/setup" -H 'Content-Type: application/json' -d "$OWNER_BODY")"
case "$RESP" in
  2*) OK 'Owner creado. La UI pedirá loguearse con esas credenciales.' ;;
  4*)
    # Ya existe: n8n responde 400 "Instance owner already setup"
    OK 'Ya existía un owner; se conserva el existente.' ;;
  *)
    WARN "/rest/owner/setup devolvió HTTP $RESP (se continúa)." ;;
esac
unset OWNER_BODY

STEP 'Renderizando credenciales a JSON (sin exponer secretos)'
# IDs fijos: deben coincidir con los IDs que referencian los workflows versionados
# en este repo (ver ./workflows/*.json). import:credentials hace upsert por id.
SMTP_HOST="$(get_env SMTP_HOST)"
SMTP_USER="$(get_env SMTP_USER)"
SMTP_PASS="$(get_env SMTP_PASS)"
SMTP_PORT="$(get_env SMTP_PORT 465)"
SMTP_SSL="$(get_env SMTP_SSL true)"

cat > "$SEED_DIR/render-credentials.js" <<'EOF'
const fs = require('fs');
const e = (k, d = '') => process.env[k] ?? d;

const creds = [
  {
    id: 'GymbroSeedMantis01',
    name: 'MantisBT API Token',
    type: 'httpHeaderAuth',
    data: { name: 'Authorization', value: e('MANTIS_API_TOKEN') },
  },
  {
    id: 'GymbroSeedRestTst01',
    name: 'Restore Test Scratch',
    type: 'postgres',
    data: {
      host: 'pg-restore-test',
      database: 'restore_test',
      user: 'restore_test',
      password: e('RESTORE_TEST_PASSWORD'),
      port: 5432,
      ssl: 'disable',
      allowUnauthorizedCerts: false,
      maxConnections: 20,
    },
  },
];

let smtpAdded = 0;
if (e('SMTP_HOST') && e('SMTP_USER') && e('SMTP_PASS')) {
  creds.push({
    id: 'GymbroSeedSmtpAcc01',
    name: 'SMTP account',
    type: 'smtp',
    data: {
      user: e('SMTP_USER'),
      password: e('SMTP_PASS'),
      host: e('SMTP_HOST'),
      port: parseInt(e('SMTP_PORT', '465'), 10) || 465,
      secure: /^(true|1|ssl|yes)$/i.test(e('SMTP_SSL', 'true')),
    },
  });
  smtpAdded = 1;
}

fs.writeFileSync('/data/seed/credentials.rendered.json', JSON.stringify(creds));
fs.writeFileSync('/data/seed/.smtp-added', String(smtpAdded));
EOF

docker exec -i \
  -e MANTIS_API_TOKEN="$MANTIS_API_TOKEN" \
  -e RESTORE_TEST_PASSWORD="$RESTORE_TEST_PASSWORD" \
  -e SMTP_HOST="$SMTP_HOST" -e SMTP_USER="$SMTP_USER" -e SMTP_PASS="$SMTP_PASS" \
  -e SMTP_PORT="$SMTP_PORT" -e SMTP_SSL="$SMTP_SSL" \
  "$CID" node /data/seed/render-credentials.js
SMTP_ADDED="$(cat "$SEED_DIR/.smtp-added" 2>/dev/null || echo 0)"
rm -f "$SEED_DIR/render-credentials.js" "$SEED_DIR/.smtp-added"

STEP 'Importando credenciales (upsert por id)'
if docker exec "$CID" n8n import:credentials --input=/data/seed/credentials.rendered.json; then
  if [ "$SMTP_ADDED" = "1" ]; then
    OK 'Credenciales listas (incluye SMTP).'
  else
    OK 'Credenciales listas (SMTP omitido: opcional por usuario).'
  fi
else
  rm -f "$SEED_DIR/credentials.rendered.json"
  FAIL 'Falló la importación de credenciales.'
  exit 1
fi

STEP 'Importando workflows (upsert por id: actualiza los existentes, sin duplicar)'
find_workflow_id() {
  local lines="$1" prefix="$2"
  while IFS='|' read -r id name; do
    case "$name" in
      "$prefix"*) printf '%s' "$id"; return 0 ;;
    esac
  done <<< "$lines"
  return 1
}

EXISTING="$(docker exec "$CID" n8n list:workflow 2>/dev/null || true)"

wf_file() {
  case "$1" in
    WF1)        printf '%s' workflow-1-alertas.json ;;
    WF2)        printf '%s' workflow-2-backups.json ;;
    WF3)        printf '%s' workflow-3-informe.json ;;
    WF-RESTORE) printf '%s' workflow-restore-test.json ;;
  esac
}

for name in WF1 WF2 WF3 WF-RESTORE; do
  file="$(wf_file "$name")"
  wf_id="$(find_workflow_id "$EXISTING" "$name" || true)"
  if [ -n "$wf_id" ]; then
    # Inyectar el id existente en una copia temporal para que n8n haga
    # upsert (actualiza el workflow en sitio en vez de duplicarlo).
    docker exec "$CID" node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/data/workflows/$file','utf8'));j.id='$wf_id';fs.writeFileSync('/data/seed/${name}.import.json',JSON.stringify(j));" \
      && import_input="/data/seed/${name}.import.json" || import_input=""
    if [ -z "$import_input" ]; then
      WARN "No se pudo preparar la copia de $file para upsert."
      continue
    fi
    if docker exec "$CID" n8n import:workflow --input="$import_input"; then
      OK "$name actualizado (upsert sobre id $wf_id)."
    else
      WARN "No se pudo actualizar $name. Revisa el archivo y los logs."
    fi
    docker exec "$CID" node -e "try{require('fs').unlinkSync('/data/seed/${name}.import.json')}catch{}"
  else
    if docker exec "$CID" n8n import:workflow --input="/data/workflows/$file"; then
      OK "$name importado."
    else
      WARN "No se pudo importar $file. Revisa el archivo y los logs."
    fi
  fi
done

EXISTING="$(docker exec "$CID" n8n list:workflow 2>/dev/null || true)"
for name in WF1 WF2 WF3; do
  WF_ID="$(find_workflow_id "$EXISTING" "$name" || true)"
  if [ -z "$WF_ID" ]; then
    WARN "No se pudo resolver el id de $name tras la importación."
    continue
  fi
  if docker exec "$CID" n8n publish:workflow --id="$WF_ID" >/dev/null; then
    OK "$name publicado (activo)."
  else
    WARN "No se pudo publicar $name."
  fi
done

STEP 'Verificando conectividad (desde dentro de n8n, sin imprimir secretos)'
cat > "$SEED_DIR/connectivity-check.js" <<'EOF'
const http = require('http');
const net = require('net');

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail: detail || '' });

function tcp(host, port, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (ok) => { try { sock.destroy(); } catch {} resolve(ok); };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    sock.once('timeout', () => done(false));
    sock.connect(port, host);
  });
}

function httpGet(urlStr, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const req = http.request({
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        timeout: timeoutMs,
      }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
      req.on('error', (e) => resolve({ status: 0, body: String(e.message || e) }));
      req.end();
    } catch (e) {
      resolve({ status: 0, body: String(e) });
    }
  });
}

function httpPropfind(urlStr, user, pass, timeoutMs = 15000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const auth = Buffer.from(user + ':' + pass).toString('base64');
      const req = http.request({
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method: 'PROPFIND',
        headers: { Authorization: 'Basic ' + auth, Depth: '0' },
        timeout: timeoutMs,
      }, (res) => { res.resume(); res.on('end', () => resolve({ status: res.statusCode })); });
      req.on('timeout', () => { req.destroy(); resolve({ status: 0 }); });
      req.on('error', (e) => resolve({ status: 0 }));
      req.end();
    } catch (e) {
      resolve({ status: 0 });
    }
  });
}

(async () => {
  const promBase = process.env.CHECK_PROMETHEUS_URL.replace(/\/+$/, '');
  const mantisBase = process.env.CHECK_MANTIS_URL.replace(/\/+$/, '');
  const ncBase = process.env.CHECK_NEXTCLOUD_URL;
  const ncUser = process.env.CHECK_NEXTCLOUD_USER;
  const ncPass = process.env.CHECK_NEXTCLOUD_PASSWORD;
  const mantisToken = process.env.CHECK_MANTIS_API_TOKEN;
  const pgHost = process.env.CHECK_POSTGRES_HOST || 'host.docker.internal';
  const pgPort = parseInt(process.env.CHECK_POSTGRES_PORT || '55433', 10);

  const p = await httpGet(promBase + '/api/v1/status/runtimeinfo');
  add('Prometheus', p.status === 200, 'HTTP ' + p.status);

  const m = await httpGet(mantisBase + '/api/rest/issues?page_size=1',
    { Authorization: mantisToken });
  add('MantisBT (API token)', m.status === 200, 'HTTP ' + m.status);

  const n = await httpPropfind(ncBase, ncUser, ncPass);
  add('Nextcloud (PROPFIND)', n.status === 207 || n.status === 200 || n.status === 301, 'HTTP ' + n.status);

  const pg = await tcp(pgHost, pgPort);
  add('PostgreSQL principal (TCP)', pg, pgHost + ':' + pgPort);

  const analyzer = await tcp('informe-analyzer', 8090);
  add('Analizador IA (TCP)', analyzer, 'informe-analyzer:8090');

  const scratch = await tcp('pg-restore-test', 5432);
  add('Postgres de restauración (TCP)', scratch, 'pg-restore-test:5432');

  for (const c of checks) {
    console.log((c.ok ? 'PASS' : 'FAIL') + '\t' + c.name + '\t' + c.detail);
  }
  process.exit(checks.every(c => c.ok) ? 0 : 2);
})().catch(e => { console.log('FAIL\tScript\t' + e); process.exit(1); });
EOF

set +e
docker exec -i \
  -e CHECK_PROMETHEUS_URL="$PROMETHEUS_URL" \
  -e CHECK_MANTIS_URL="$MANTIS_URL" \
  -e CHECK_MANTIS_API_TOKEN="$MANTIS_API_TOKEN" \
  -e CHECK_NEXTCLOUD_URL="$NEXTCLOUD_URL" \
  -e CHECK_NEXTCLOUD_USER="$NEXTCLOUD_USER" \
  -e CHECK_NEXTCLOUD_PASSWORD="$NEXTCLOUD_PASSWORD" \
  -e CHECK_POSTGRES_HOST="$(get_env POSTGRES_HOST host.docker.internal)" \
  -e CHECK_POSTGRES_PORT="$(get_env POSTGRES_PORT 55433)" \
  "$CID" node /data/seed/connectivity-check.js
CHECK_EXIT=$?
set -e
if [ "$CHECK_EXIT" -ne 0 ]; then
  WARN 'Alguno de los chequeos falló (ver detalle arriba). Los workflows igualmente quedaron importados.'
fi

STEP 'Reiniciando n8n para aplicar los cambios importados'
if docker restart "$CID" >/dev/null; then
  OK 'n8n reiniciado.'
else
  WARN 'No se pudo reiniciar n8n; hacelo manualmente (docker restart gymbro-n8n).'
fi

STEP 'Limpiando archivos sensibles temporales'
rm -f "$SEED_DIR/credentials.rendered.json" "$SEED_DIR/connectivity-check.js" "$SEED_DIR"/WF*.import.json
OK "Listo. Abre $BASE_URL y loguéate con tu N8N_ADMIN_EMAIL / N8N_ADMIN_PASSWORD del .env."

cat <<EOF

Resumen de activación:
  WF1 (Alertas)       -> ACTIVO (cada 30 s)
  WF2 (Backups)       -> ACTIVO (diario 03:00)
  WF3 (Informe IA)    -> ACTIVO (lunes 08:00)
  WF-RESTORE (manual) -> NO publicado a propósito
EOF
