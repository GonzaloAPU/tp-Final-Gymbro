# Política de Protección de Secretos en Documentación y Repositorio

## 1. Regla General (Actividad 7 — Punto 12)
Queda estrictamente prohibido almacenar en **Nextcloud** o en el repositorio **Git** secretos sin protección, tales como:
- Archivos `.env` con credenciales reales de producción.
- Tokens de acceso personal (PAT) de GitHub, tokens de API de Trello o claves de webhooks de n8n.
- Certificados privados (`*.key`, `*.pem`, `*.jks`, `*.keystore`).
- Dumps de base de datos con información sensible sin anonimizar (`*.dump`, `*.sql.gz`).

## 2. Mecanismos implementados en SmartGymBro
1. **Exclusión en `.gitignore`:** El archivo `.gitignore` en la raíz bloquea `.env`, `.env.*` (excepto `!.env.example`), `*.key`, `*.keystore` y `*.dump`.
2. **Configuración como Código en Nextcloud:** El contenedor `gymbro-nextcloud` se aprovisiona mediante el hook `/docker-entrypoint-hooks.d/post-installation/01-setup-smartgymbro.sh` leyendo variables de entorno (`NEXTCLOUD_ADMIN_USER`, `NEXTCLOUD_ADMIN_PASSWORD`, `NEXTCLOUD_TEAM_PASSWORD`), sin subir volúmenes de datos ni bases SQLite a GitHub.
3. **Plantillas saneadas:** En la documentación técnica solo se incluyen plantillas de referencia (`.env.example`) con marcadores de posición.
