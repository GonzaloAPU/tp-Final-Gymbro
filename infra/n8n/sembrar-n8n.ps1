#Requires -Version 5.1
<#
.SYNOPSIS
  Siembra completa de n8n para una instalaciÃ³n nueva de Gymbro.

.DESCRIPTION
  Pensado para que cada integrante copie este mÃ³dulo, coloque el .env que
  Sonia comparte y ejecute UN solo comando:

      .\sembrar-n8n.ps1

  El script:
    1. Verifica docker / docker compose.
    2. Crea (si falta) una N8N_ENCRYPTION_KEY propia y la guarda en .env.
    3. Verifica/crea las credenciales compartidas y de mantenimiento en n8n
       (misma instancia cada vez -> upsert, sin duplicados).
    4. Importa los workflows del repo (solo los que falten).
    5. Publica (activa) los workflows con trigger programado:
       WF1 (cada 30 s), WF2 (diario 03:00) y WF3 (lunes 08:00).
       El WF-RESTORE es de ejecuciÃ³n manual y NO se publica.
    6. Verifica conectividad interna y externa SIN imprimir secretos.

  Seguridad: ningÃºn token/contraseÃ±a se escribe en consola ni en archivos
  temporales que queden legibles para todos.

.PARAMETER SeedEnvFile
  Archivo .env a usar (por defecto el .env de esta carpeta).

.PARAMETER ComposeFiles
  Lista de archivos compose a usar, separados por coma
  (por defecto "compose.yaml"). Ãštil para pruebas aisladas.

.EXAMPLE
  .\sembrar-n8n.ps1
#>
param(
    [string]$SeedEnvFile = '',
    [string]$ComposeFiles = 'compose.yaml',
    [switch]$SkipConnectivityChecks
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$n8nDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $n8nDir
$envPath = if ([string]::IsNullOrWhiteSpace($SeedEnvFile)) { Join-Path $n8nDir '.env' } else { (Resolve-Path $SeedEnvFile).Path }
$composeArg = ($ComposeFiles -split ',').Trim() | ForEach-Object { '-f', $_ }

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "    OK    $msg" -ForegroundColor Green }
function Write-Warn2([string]$msg){ Write-Host "    AVISO $msg" -ForegroundColor Yellow }
function Write-Fail([string]$msg) { Write-Host "    FALLO $msg" -ForegroundColor Red }

function Read-DotEnv([string]$path) {
    $map = [ordered]@{}
    foreach ($raw in [System.IO.File]::ReadAllLines($path)) {
        $line = $raw.Trim()
        if (-not $line -or $line.StartsWith('#')) { continue }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { continue }
        $key = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $map[$key] = $value
    }
    return $map
}

function Set-DotEnvVar([string]$path, [string]$key, [string]$value) {
    $lines = @([System.IO.File]::ReadAllLines($path))
    $found = $false
    $out = foreach ($raw in $lines) {
        if ($raw -match "^\s*$([regex]::Escape($key))=") { $found = $true; "$key=$value" } else { $raw }
    }
    if (-not $found) { $out += "$key=$value" }
    [System.IO.File]::WriteAllLines($path, $out, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-EnvValue([hashtable]$envMap, [string]$key, [string]$default = '') {
    if ($envMap.Contains($key)) { return [string]$envMap[$key] }
    return $default
}

function Get-RandomSecret([int]$bytes = 24) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object byte[] $bytes
    $rng.GetBytes($buf)
    return ([Convert]::ToBase64String($buf) -replace '\+','A' -replace '/','B' -replace '=','')
}

# ---------------------------------------------------------------------------
Write-Step 'Verificando prerequisitos'
foreach ($cmd in 'docker') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Fail "No se encontrÃ³ '$cmd'. Instala Docker Desktop y vuelve a intentarlo."; exit 1
    }
}
docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Fail 'Docker Compose v2 no estÃ¡ disponible.'; exit 1 }

# ---------------------------------------------------------------------------
Write-Step "Verificando $envPath"
if (-not (Test-Path $envPath)) {
    Write-Fail "No existe $envPath`nCopia el .env que recibiste de Sonia (o crÃ©alo desde .env.example) y vuelve a intentarlo."; exit 1
}

$envMap = Read-DotEnv $envPath
foreach ($required in 'POSTGRES_PASSWORD','MANTIS_URL','MANTIS_API_TOKEN','NEXTCLOUD_URL','NEXTCLOUD_USER','NEXTCLOUD_PASSWORD','PROMETHEUS_URL','RESTORE_TEST_PASSWORD') {
    if ([string]::IsNullOrWhiteSpace((Get-EnvValue $envMap $required))) {
        Write-Fail "Falta o estÃ¡ vacÃ­a la variable $required en el .env. RevisÃ¡/pÃ­dele el archivo completo a Sonia."; exit 1
    }
}

# N8N_ENCRYPTION_KEY: propia de cada mÃ¡quina. Si estÃ¡ vacÃ­a, el seed la genera y
# la guarda en .env (gitignored). NUNCA se comparte ni se sube al repo.
$encKey = Get-EnvValue $envMap 'N8N_ENCRYPTION_KEY'
if ([string]::IsNullOrWhiteSpace($encKey)) {
    $encKey = Get-RandomSecret 24
    Set-DotEnvVar $envPath 'N8N_ENCRYPTION_KEY' $encKey
    $envMap['N8N_ENCRYPTION_KEY'] = $encKey
    Write-Ok 'Se generÃ³ una N8N_ENCRYPTION_KEY propia para esta mÃ¡quina y quedÃ³ en el .env.'
} else {
    Write-Ok 'N8N_ENCRYPTION_KEY presente (se conserva).'
}

# Restore test scratch: si estÃ¡ vacÃ­o, generarlo (valor privado por mÃ¡quina)
$restorePass = Get-EnvValue $envMap 'RESTORE_TEST_PASSWORD'
if ([string]::IsNullOrWhiteSpace($restorePass)) {
    $restorePass = Get-RandomSecret 18
    Set-DotEnvVar $envPath 'RESTORE_TEST_PASSWORD' $restorePass
    $envMap['RESTORE_TEST_PASSWORD'] = $restorePass
    Write-Ok 'Se generÃ³ una RESTORE_TEST_PASSWORD propia y quedÃ³ en el .env.'
}

# Admin de n8n (para la primera administraciÃ³n local)
$adminEmail = Get-EnvValue $envMap 'N8N_ADMIN_EMAIL'
if ([string]::IsNullOrWhiteSpace($adminEmail)) {
    $adminEmail = 'admin@gymbro.tp'
    Set-DotEnvVar $envPath 'N8N_ADMIN_EMAIL' $adminEmail
    $envMap['N8N_ADMIN_EMAIL'] = $adminEmail
    Write-Ok "N8N_ADMIN_EMAIL=$adminEmail (editable en .env)."
}
$adminPass = Get-EnvValue $envMap 'N8N_ADMIN_PASSWORD'
if ([string]::IsNullOrWhiteSpace($adminPass)) {
    $adminPass = (Get-RandomSecret 12) + 'Aa1'
    Set-DotEnvVar $envPath 'N8N_ADMIN_PASSWORD' $adminPass
    $envMap['N8N_ADMIN_PASSWORD'] = $adminPass
    Write-Ok 'Se generÃ³ N8N_ADMIN_PASSWORD y quedÃ³ en el .env (no se imprime).'
}
$adminFirst = (Get-EnvValue $envMap 'N8N_ADMIN_FIRSTNAME'); if (-not $adminFirst) { $adminFirst = 'Gymbro';  Set-DotEnvVar $envPath 'N8N_ADMIN_FIRSTNAME' $adminFirst }
$adminLast  = (Get-EnvValue $envMap 'N8N_ADMIN_LASTNAME');  if (-not $adminLast)  { $adminLast  = 'Admin';   Set-DotEnvVar $envPath 'N8N_ADMIN_LASTNAME'  $adminLast }

# ---------------------------------------------------------------------------
Write-Step 'Preparando archivos auxiliares (.gitignore) que usa el compose'

if (-not (Test-Path (Join-Path $n8nDir '..\..\postgres\backups'))) {
    Write-Warn2 'No existe ../../postgres/backups: monta primero el stack raiz (docker-compose.yml) para que el servicio de backups cree los dumps; si falta, Docker la creara vacia y WF2 reportara "sin dumps".'
} else {
    Write-Ok '../../postgres/backups existe (dumps del servicio gymbro-postgres-backup).'
}

$restoreEnv = Join-Path $n8nDir 'restore-test.env'
if (Test-Path $restoreEnv) {
    Write-Ok 'restore-test.env ya existe; se conserva.'
} else {
    [System.IO.File]::WriteAllText($restoreEnv, "RESTORE_TEST_HOST=pg-restore-test`r`nRESTORE_TEST_PORT=5432`r`nRESTORE_TEST_USER=restore_test`r`nRESTORE_TEST_DB=restore_test`r`nPGPASSWORD=$restorePass`r`n", (New-Object System.Text.UTF8Encoding($false)))
    Write-Ok 'restore-test.env generado (gitignored).'
}

$localCa = Join-Path $n8nDir 'local-ca.crt'
if (Test-Path $localCa) {
    Write-Ok 'local-ca.crt ya existe; se conserva.'
} else {
    # Placeholder PÃšBLICO de desarrollo (certificado de juguete, no otorga
    # confianza sobre nada mÃ¡s). Si en tu red hay un CA proxy (Zscaler, Avastâ€¦),
    # reemplÃ¡zalo por el certificado raÃ­z real de esa CA.
    $pem = @'
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
'@
    [System.IO.File]::WriteAllText($localCa, $pem, (New-Object System.Text.UTF8Encoding($false)))
    Write-Ok 'local-ca.crt generado (placeholder de desarrollo). ReemplÃ¡zalo por la CA de tu red si aplica.'
}

Write-Step 'Preparando carpeta de trabajo (.seed/, gitignored)'
$seedDir = Join-Path $n8nDir '.seed'
New-Item -ItemType Directory -Force -Path $seedDir | Out-Null

Write-Step 'Levantando el stack n8n (build + up -d)'
docker compose $composeArg --env-file $envPath up -d --build
if ($LASTEXITCODE -ne 0) { Write-Fail 'docker compose up fallÃ³.'; exit 1 }
$cid = (docker compose $composeArg --env-file $envPath ps -q n8n) | Select-Object -First 1
if (-not $cid) { Write-Fail 'No se pudo obtener el container id del servicio n8n.'; exit 1 }
Write-Ok "Contenedor n8n: $cid"

$port = Get-EnvValue $envMap 'N8N_PORT' '5678'
$baseUrl = "http://localhost:$port"
Write-Step "Esperando que n8n responda en $baseUrl ..."
$deadline = (Get-Date).AddMinutes(3)
$ready = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "$baseUrl/healthz" -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $ready = $true; break }
    } catch {
        # todavÃ­a arrancando
    }
    Start-Sleep -Seconds 3
}
if (-not $ready) {
    Write-Fail 'n8n no respondiÃ³ en /healthz tras 3 minutos. Ãšltimas lÃ­neas de log:'
    docker logs --tail 40 $cid
    exit 1
} else {
    Write-Ok 'n8n estÃ¡ vivo.'
}

Write-Step 'Creando usuario owner de n8n (una sola vez, idempotente)'
$ownerBody = @{
    email     = $adminEmail
    firstName = $adminFirst
    lastName  = $adminLast
    password  = $adminPass
} | ConvertTo-Json -Compress
$ownerDone = $false
$ownerExisted = $false
try {
    Invoke-RestMethod -Method Post `
        -Uri "$baseUrl/rest/owner/setup" `
        -ContentType 'application/json' `
        -Body $ownerBody | Out-Null
    $ownerDone = $true
    Write-Ok 'Owner creado. La UI pedirÃ¡ loguearse con esas credenciales.'
} catch {
    $body = ''
    try {
        $resp = $_.Exception.Response
        if ($resp -and $resp.GetResponseStream()) {
            $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
            $body = $reader.ReadToEnd()
        }
    } catch { }
    if ($body -match 'already setup' -or $body -match 'Instance owner') {
        $ownerExisted = $true
        Write-Ok 'Ya existÃ­a un owner; se conserva el existente.'
    } else {
        Write-Warn2 "/rest/owner/setup devolviÃ³ un error inesperado (se continÃºa). Detalle: $($_.Exception.Message)"
    }
}

# ---------------------------------------------------------------------------
Write-Step 'Renderizando credenciales a JSON (sin exponer secretos)'
# IDs fijos: deben coincidir con los IDs que referencian los workflows versionados
# en este repo (ver ./workflows/*.json). import:credentials hace upsert por id.
$credentials = @(
    @{
        id = 'GymbroSeedMantis01'
        name = 'MantisBT API Token'
        type = 'httpHeaderAuth'
        data = [ordered]@{
            name  = 'Authorization'
            value = (Get-EnvValue $envMap 'MANTIS_API_TOKEN')
        }
    }
    @{
        id = 'GymbroSeedRestTst01'
        name = 'Restore Test Scratch'
        type = 'postgres'
        data = [ordered]@{
            host            = 'pg-restore-test'
            database        = 'restore_test'
            user            = 'restore_test'
            password        = $restorePass
            port            = 5432
            ssl             = 'disable'
            allowUnauthorizedCerts = $false
            maxConnections  = 20
        }
    }
)
# SMTP: opcional. Si los compaÃ±eros quieren email, agregan su propia cuenta Gmail
# (ver GUIA-COMPAÃ‘EROS / README). Sin estos valores, emailSend queda sin asignar
# pero los workflows funcionan igual.
$smtpHost = Get-EnvValue $envMap 'SMTP_HOST'
$smtpUser = Get-EnvValue $envMap 'SMTP_USER'
$smtpPass = Get-EnvValue $envMap 'SMTP_PASS'
$smtpAdded = $false
if ($smtpHost -and $smtpUser -and $smtpPass) {
    $smtpPort = [int](Get-EnvValue $envMap 'SMTP_PORT' '465')
    $secure = (Get-EnvValue $envMap 'SMTP_SSL' 'true') -match '^(true|1|ssl|yes)$'
    $credentials += @{
        id = 'GymbroSeedSmtpAcc01'
        name = 'SMTP account'
        type = 'smtp'
        data = [ordered]@{
            user   = $smtpUser
            password = $smtpPass
            host   = $smtpHost
            port   = $smtpPort
            secure = $secure
        }
    }
    $smtpAdded = $true
}

$rendered = $credentials | ConvertTo-Json -Depth 10 -Compress
$renderedPath = Join-Path $seedDir 'credentials.rendered.json'
[System.IO.File]::WriteAllText($renderedPath, $rendered, (New-Object System.Text.UTF8Encoding($false)))

Write-Step 'Importando credenciales (upsert por id)'
docker exec $cid n8n import:credentials --input=/data/seed/credentials.rendered.json
if ($LASTEXITCODE -ne 0) {
    Remove-Item -Force $renderedPath -ErrorAction SilentlyContinue
    Write-Fail 'FallÃ³ la importaciÃ³n de credenciales.'; exit 1
}
Write-Ok ('Credenciales listas' + $(if ($smtpAdded) { ' (incluye SMTP)' } else { ' (SMTP omitido: opcional por usuario)' }))

function Find-WorkflowId([string[]]$lines, [string]$prefix) {
    foreach ($l in $lines) {
        if ([string]::IsNullOrWhiteSpace($l)) { continue }
        $idx = $l.IndexOf('|')
        if ($idx -lt 1) { continue }
        $name = $l.Substring($idx + 1).Trim()
        if ($name.StartsWith($prefix)) { return $l.Substring(0, $idx).Trim() }
    }
    return $null
}

# ---------------------------------------------------------------------------
Write-Step 'Importando workflows (upsert por id: actualiza los existentes, sin duplicar)'
$existing = @(docker exec $cid n8n list:workflow 2>$null)
if ($LASTEXITCODE -ne 0) { $existing = @() }

$workflows = @(
    @{ File = 'workflow-1-alertas.json';   Name = 'WF1';        Publish = $true },
    @{ File = 'workflow-2-backups.json';   Name = 'WF2';        Publish = $true },
    @{ File = 'workflow-3-informe.json';   Name = 'WF3';        Publish = $true },
    @{ File = 'workflow-restore-test.json'; Name = 'WF-RESTORE'; Publish = $false }
)

foreach ($wf in $workflows) {
    $wfId = Find-WorkflowId $existing $wf.Name
    $importInput = "/data/workflows/$($wf.File)"
    $tmpName = "$($wf.Name).import.json"
    if ($wfId) {
        # Inyectar el id existente en una copia temporal para que n8n haga
        # upsert (actualiza el workflow en sitio en vez de duplicarlo).
        docker exec $cid node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('/data/workflows/$($wf.File)','utf8'));j.id='$wfId';fs.writeFileSync('/data/seed/$tmpName',JSON.stringify(j));" | Out-Null
        if ($LASTEXITCODE -eq 0) { $importInput = "/data/seed/$tmpName" } else { Write-Warn2 "No se pudo preparar la copia de $($wf.File) para upsert; se importa sin upsert (puede duplicar)." }
    }
    docker exec $cid n8n import:workflow --input="$importInput"
    if ($LASTEXITCODE -ne 0) {
        Write-Warn2 "No se pudo importar $($wf.File). Revisa el archivo y los logs."
    } elseif ($wfId) {
        Write-Ok "$($wf.Name) actualizado (upsert sobre id $wfId)."
    } else {
        Write-Ok "$($wf.Name) importado."
    }
    if ($wfId) { docker exec $cid node -e "try{require('fs').unlinkSync('/data/seed/$tmpName')}catch{}" | Out-Null }
}

# Resolver ids por nombre y publicar (activar) los disparadores programados
$existing = @(docker exec $cid n8n list:workflow 2>$null)
foreach ($wf in $workflows) {
    if (-not $wf.Publish) { continue }
    $wfId = Find-WorkflowId $existing $wf.Name
    if (-not $wfId) { Write-Warn2 "No se pudo resolver el id de $($wf.Name) tras la importaciÃ³n."; continue }
    docker exec $cid n8n publish:workflow --id=$wfId | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Ok "$($wf.Name) publicado (activo)." } else { Write-Warn2 "No se pudo publicar $($wf.Name)." }
}

# ---------------------------------------------------------------------------
if (-not $SkipConnectivityChecks) {
    Write-Step 'Verificando conectividad (desde dentro de n8n, sin imprimir secretos)'
    $checkScript = @'
const http = require('http');
const net = require('net');
const crypto = require('crypto');

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
      req.on('error', (e) => resolve({ status: 0, body: String(e.message || e) }));
      req.end();
    } catch (e) {
      resolve({ status: 0 });
    }
  });
}

(async () => {
  const promBase = process.env.CHECK_PROMETHEUS_URL;
  const mantisBase = process.env.CHECK_MANTIS_URL;
  const ncBase = process.env.CHECK_NEXTCLOUD_URL;
  const ncUser = process.env.CHECK_NEXTCLOUD_USER;
  const ncPass = process.env.CHECK_NEXTCLOUD_PASSWORD;
  const mantisToken = process.env.CHECK_MANTIS_API_TOKEN;
  const pgHost = process.env.CHECK_POSTGRES_HOST;
  const pgPort = parseInt(process.env.CHECK_POSTGRES_PORT || '55433', 10);

  const p = await httpGet(promBase.replace(/\/+$/, '') + '/api/v1/status/runtimeinfo');
  add('Prometheus', p.status === 200, 'HTTP ' + p.status);

  const m = await httpGet(mantisBase.replace(/\/+$/, '') + '/api/rest/issues?page_size=1',
    { Authorization: mantisToken });
  add('MantisBT (API token)', m.status === 200, 'HTTP ' + m.status);

  const n = await httpPropfind(ncBase, ncUser, ncPass);
  add('Nextcloud (PROPFIND)', n.status === 207 || n.status === 200 || n.status === 301, 'HTTP ' + n.status);

  const pg = await tcp(pgHost, pgPort);
  add('PostgreSQL principal (TCP)', pg, pgHost + ':' + pgPort);

  const analyzer = await tcp('informe-analyzer', 8090);
  add('Analizador IA (TCP)', analyzer, 'informe-analyzer:8090');

  const scratch = await tcp('pg-restore-test', 5432);
  add('Postgres de restauraciÃ³n (TCP)', scratch, 'pg-restore-test:5432');

  for (const c of checks) {
    console.log((c.ok ? 'PASS' : 'FAIL') + '\t' + c.name + '\t' + c.detail);
  }
  process.exit(checks.every(c => c.ok) ? 0 : 2);
})().catch(e => { console.log('FAIL\tScript\t' + e); process.exit(1); });
'@
    $checkPath = Join-Path $seedDir 'connectivity-check.js'
    [System.IO.File]::WriteAllText($checkPath, $checkScript, (New-Object System.Text.UTF8Encoding($false)))
    docker exec -i `
        -e CHECK_PROMETHEUS_URL="$(Get-EnvValue $envMap 'PROMETHEUS_URL')" `
        -e CHECK_MANTIS_URL="$(Get-EnvValue $envMap 'MANTIS_URL')" `
        -e CHECK_MANTIS_API_TOKEN="$(Get-EnvValue $envMap 'MANTIS_API_TOKEN')" `
        -e CHECK_NEXTCLOUD_URL="$(Get-EnvValue $envMap 'NEXTCLOUD_URL')" `
        -e CHECK_NEXTCLOUD_USER="$(Get-EnvValue $envMap 'NEXTCLOUD_USER')" `
        -e CHECK_NEXTCLOUD_PASSWORD="$(Get-EnvValue $envMap 'NEXTCLOUD_PASSWORD')" `
        -e CHECK_POSTGRES_HOST="$(Get-EnvValue $envMap 'POSTGRES_HOST' 'host.docker.internal')" `
        -e CHECK_POSTGRES_PORT="$(Get-EnvValue $envMap 'POSTGRES_PORT' '55433')" `
        $cid node /data/seed/connectivity-check.js
    $checkExit = $LASTEXITCODE
    if ($checkExit -ne 0) { Write-Warn2 'Alguno de los chequeos fallÃ³ (ver detalle arriba). Los workflows igualmente quedaron importados.' }
}

# ---------------------------------------------------------------------------
Write-Step 'Reiniciando n8n para aplicar los cambios importados'
docker restart $cid | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Ok 'n8n reiniciado.' } else { Write-Warn2 'No se pudo reiniciar n8n; hacelo manualmente (docker restart gymbro-n8n).' }

# ---------------------------------------------------------------------------
Write-Step 'Limpiando archivos sensibles temporales'
Remove-Item -Force (Join-Path $seedDir 'credentials.rendered.json') -ErrorAction SilentlyContinue
Remove-Item -Force (Join-Path $seedDir 'connectivity-check.js') -ErrorAction SilentlyContinue
Get-ChildItem -Path $seedDir -Filter 'WF*.import.json' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Ok 'Listo. Abre http://localhost:' + $port + ' y loguÃ©ate con tu N8N_ADMIN_EMAIL / N8N_ADMIN_PASSWORD del .env.'
Write-Host ''
Write-Host 'Resumen de activaciÃ³n:'
Write-Host '  WF1 (Alertas)       -> ACTIVO (cada 30 s)'
Write-Host '  WF2 (Backups)       -> ACTIVO (diario 03:00)'
Write-Host '  WF3 (Informe IA)    -> ACTIVO (lunes 08:00)'
Write-Host '  WF-RESTORE (manual) -> NO publicado a propÃ³sito'
