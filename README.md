# Gymbro AI — TP Final

Repositorio local nuevo, independiente de Gymbro. Contiene una base funcional de Angular, Express/Sequelize y PostgreSQL para que el equipo desarrolle la infraestructura del TP por ramas.

## Módulos

- `backend/`: API Node.js, modelos, servicios, migraciones y pruebas.
- `frontend/`: interfaz Angular 22.2.4, exclusivamente web para el TP.
- `postgres/`: SQL, Docker Compose local y tareas de datos/replicación de Facundo.
- `shared/`: documentos y contratos compartidos por la aplicación. No es un cuarto servicio.
- `tools/`: pruebas y generadores compartidos.
- `infra/`: espacios independientes de app, CI/CD, monitoreo, n8n, incidencias y Nextcloud.
- `docs/`: cronograma, tareas, flujo Git, evidencias e integración.

## Inicio local

Requisitos: Node 24.15 o posterior de la rama 24, npm y Docker con Compose v2.

```powershell
npm ci
npm run configurar:local
npm run postgres:up
npm run postgres:verificar
npm run dev
```

Frontend: http://localhost:4300. API: http://localhost:3100/api/health. pgAdmin: http://localhost:5051. PostgreSQL: 127.0.0.1:55433, base y usuario `smartgymbro_tp`. Las contraseñas locales están en los `.env` generados; nunca se suben a Git.

Para pgAdmin, el servidor dentro de Docker se llama `postgres-primary`, puerto 5432. La inicialización carga 190 ejercicios y deja las 16 tablas en español. Solo se ejecuta al crear un volumen vacío. No contiene cuentas ni entrenamientos reales.

Gemini y EmailJS quedan sin configurar; las rutinas locales funcionan sin servicios externos. El frontend utiliza la API local, no Render ni Supabase. Los volúmenes y puertos son distintos de los del proyecto original.

## Validación

```powershell
npm test
npm run typecheck
npm run build
npm run verificar:modulos
```

Las pruebas usan servicios simulados y PostgreSQL embebido. La replicación, 6 millones de registros, contenedores web, CI/CD, monitoreo, n8n, Mantis, Nextcloud y túnel son tareas del equipo, todavía pendientes; no se presentan como implementadas.

## Repositorio y ramas

Esta es la base de integración publicada en develop de GonzaloAPU/tp-Final-Gymbro. Las ramas son main, develop, feature/aldo, feature/facundo, feature/sonia y feature/rodrigo. Cada compañero crea su feature desde develop y hace sus propios commits. Los PR van a develop; la entrega validada se integra en main mediante PR y una aprobación.

El repositorio ya está inicializado: clonar, no crear otro historial ni hacer force push. Consultar docs/FLUJO-GIT.md y docs/CONFIGURACION-GITHUB.md para las reglas y la autenticación de GHCR con GITHUB_TOKEN. Las partes de infraestructura pendientes continúan siendo tareas del equipo.

## Comprobación real de la base

Con PostgreSQL iniciado, ejecutar `npm run postgres:smoke`. La prueba clona la base local en una base temporal, prueba las rutas HTTP y elimina la copia al finalizar. No envía correos ni llama a Gemini. El PostgreSQL original del TP conserva sus datos.

pgAdmin usa el correo local `admin@example.com` y la contraseña generada en `postgres/.env`. No se envían mensajes a ese correo.

Ver el resultado y los límites de la revisión en `docs/VALIDACION-INICIAL.md`. Antes de compartir la carpeta, excluir `.env`, `node_modules`, archivos de compilación y logs; cada compañero ejecuta `npm ci` y `npm run configurar:local`.
