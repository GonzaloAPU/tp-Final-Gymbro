# Guía de Trabajo Operativo - SmartGymBro

Esta guía define **dónde** y **cómo** debe trabajar cada integrante del equipo para avanzar en paralelo sin bloquearse ni sobrescribir el código de sus compañeros.

---

## 1. El Entorno de Trabajo (¿Dónde trabajamos?)

**Nadie trabaja en la computadora de otro ni en un servidor en la nube por ahora.**
Cada integrante trabajará **exclusivamente en su propia notebook o PC local**. 
El único punto de encuentro es el repositorio remoto en GitHub. El día del ensamble (Sprint 3), todos descargarán la versión final en la notebook de Aldo para la exposición.

### El Flujo de Trabajo (Git Flow)
Para evitar conflictos (que dos personas modifiquen la misma línea de código a la vez), seguiremos estos pasos:

1. **Clonar el repositorio:** Cada uno descarga el código en su PC (`git clone https://github.com/GonzaloAPU/gymbro.git`).
2. **Crear una rama propia:** Antes de tocar un archivo, crear una rama para la tarea específica. 
   * *Ejemplo:* `git checkout -b feature/base-datos-facundo`
3. **Desarrollar y probar localmente:** Escribir el código o configurar Docker y probar que funcione en la propia PC.
4. **Subir los cambios (Push):** Subir la rama a GitHub (`git push origin feature/base-datos-facundo`).
5. **Pull Request (PR):** En GitHub, pedir que se integre la rama al `main`. **Gonzalo** revisará que no rompa nada y le dará "Merge".
6. **Actualizar:** Los demás compañeros ejecutan `git pull origin main` en sus máquinas para recibir los cambios aprobados.

---

## 2. Desglose de Tareas por Integrante (¿Qué hace cada uno?)

### 👨‍💻 Gonzalo (Scrum Master / Gestión)
* **Dónde trabaja:** Navegador web (Jira/GitHub) y entorno local para documentación.
* **Archivos que toca:** `README.md`, carpeta `docs/`.
* **Actividades exactas:**
  1. Configurar el tablero de Jira e invitar al equipo.
  2. Cargar en Jira las historias de usuario de las funcionalidades que la app ya tiene (login, rutinas, etc.) y pasarlas a "Terminado" (Done).
  3. Cargar las tareas de infraestructura para este TP en "Por hacer" (To Do).
  4. Levantar Nextcloud con Docker localmente para guardar los documentos.
  5. Recibir las Pull Requests en GitHub, verificar que no tengan contraseñas expuestas y hacer el Merge a la rama `main`.

### 👨‍💻 Aldo (Contenedores Web, CI/CD y Túnel)
* **Dónde trabaja:** Entorno local (VS Code / Terminal).
* **Ramas sugeridas:** `feature/docker-app`, `feature/ci-cd`.
* **Archivos que toca:** `backend/Dockerfile`, `frontend/Dockerfile`, `.github/workflows/deploy.yml`, `docker-compose.yml`.
* **Actividades exactas:**
  1. Escribir el `Dockerfile` para empaquetar el backend de Node.js.
  2. Escribir el `Dockerfile` para empaquetar el frontend de Angular.
  3. Agregar estos contenedores al `docker-compose.yml` para que la app levante sola.
  4. Crear la carpeta `.github/workflows` y armar el pipeline de GitHub Actions para que valide la app en cada Push.
  5. Instalar Cloudflare Tunnel o Tailscale en la notebook física que irá a la facultad y probar publicar el puerto local en Internet.

### 👨‍💻 Facundo (Base de Datos)
* **Dónde trabaja:** Entorno local, usando PgAdmin o DBeaver.
* **Ramas sugeridas:** `feature/db-optimization`, `feature/db-replication`.
* **Archivos que toca:** `docker-compose.yml`, carpeta `backend/scripts/` o `database/`.
* **Actividades exactas:**
  1. Programar un script (puede ser un `.js` en Node o un script de Python) que se conecte a Postgres y genere 6 millones de registros de prueba (ej. historiales de peso falsos).
  2. Modificar el `docker-compose.yml` para levantar un `postgres-primary` y un `postgres-replica`.
  3. Configurar los archivos `postgresql.conf` y `pg_hba.conf` para habilitar la replicación.
  4. Ejecutar comandos `EXPLAIN ANALYZE` sobre las consultas del backend, crear índices SQL y guardar los resultados en un archivo `.md` o `.pdf` para Gonzalo.

### 👩‍💻 Sonia (Monitoreo y Automatización)
* **Dónde trabaja:** Entorno local.
* **Ramas sugeridas:** `feature/monitoring`, `feature/n8n-automation`.
* **Archivos que toca:** `docker-compose.yml`, `prometheus.yml`, exportar JSONs de Grafana.
* **Actividades exactas:**
  1. Agregar a `docker-compose.yml` los servicios: Prometheus, Grafana, cAdvisor y postgres-exporter.
  2. Crear el archivo de configuración `prometheus.yml` indicando qué puertos debe leer.
  3. Entrar a Grafana en el navegador local (`localhost:3000`), armar los gráficos de CPU, RAM y BD, y exportar el Dashboard como archivo JSON para subirlo al repo.
  4. Agregar `n8n` al Docker Compose, armar los 3 flujos requeridos gráficamente, exportar los flujos en formato JSON y subirlos al repositorio.

### 👨‍💻 Rodrigo (Seguridad e Incidencias)
* **Dónde trabaja:** Entorno local (Terminal y Navegador).
* **Ramas sugeridas:** `feature/security-audit`, `feature/mantis`.
* **Archivos que toca:** `docker-compose.yml`, reportes Markdown en carpeta `docs/security/`.
* **Actividades exactas:**
  1. Agregar Mantis Bug Tracker al `docker-compose.yml` junto con su propia base de datos pequeña.
  2. Ejecutar `npm audit` en el frontend y backend.
  3. Atacar la API localmente (intentar Inyección SQL en el login, intentar mandar un JWT falso).
  4. Documentar todas las vulnerabilidades detectadas en un archivo `informe-seguridad.md`.
  5. Cargar estas 10 vulnerabilidades como tickets/incidencias dentro del Mantis local. Exportar la base de datos de Mantis o tomar capturas de pantalla para entregar a Gonzalo.