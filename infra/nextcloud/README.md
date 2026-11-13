# Punto 12: gestión documental en Nextcloud

## Preparación incluida

El hook `hooks/post-installation/01-setup-smartgymbro.sh` llama a `setup-smartgymbro.php`.
Puede ejecutarse durante una instalación nueva o manualmente en una existente.
No escribe documentos directamente en `data/`, ni cambia tablas SQL: utiliza las APIs de Nextcloud.

- Crea seis carpetas compartidas bajo `SmartGymBro-TP-Final`, propiedad de `gonzalo`.
- Crea los cinco integrantes y los grupos del equipo. Conserva las contraseñas de usuarios existentes.
- Nuevas cuentas: contraseña aleatoria distinta, no guardada ni mostrada. Establecer una contraseña personal después mediante administración o `occ user:resetpassword` interactivo.
- Gonzalo administra; cada integrante puede leer todas las carpetas, editar su área y el registro de entregables. No se delega volver a compartir.
- Deniega enlaces públicos, subida pública, compartir por grupos y volver a compartir. Si detecta cuentas ajenas o comparticiones inesperadas, termina con error para revisión manual; no las elimina automáticamente.
- Importa únicamente una lista cerrada de documentos técnicos y diez PDF verificados por SHA-256. No copia `.env`, claves ni todo el repositorio.
- Reutiliza archivos idénticos. Conserva revisiones anteriores de los informes por hash en `06-Registro-Versiones-Entregables/Versiones-PDF`, además de activar `files_versions`.
- Genera `REGISTRO-INFORMES.md`, `manifest.json`, `MATRIZ-PERMISOS.md` y `VERIFICACION-PUNTO12.json`.

## Responsables de informes

| Responsable | Informes | Carpeta |
|---|---|---|
| Facundo | Puntos 4, 5 (optimización) y 6 | 02-Base-de-Datos-y-Replicacion |
| Aldo Dante, cuenta `aldo` | Scrum/DevOps y puntos 7, 8, 9 | 03-Docker-CI-CD-y-Rollback |
| Rodrigo | Seguridad e incidencias, puntos 11 y 14 | 04-Seguridad-e-Incidencias |
| Sonia | Monitoreo Prometheus/Grafana y flujos n8n | 05-Monitoreo-y-Automatizacion |

La atribución sigue los archivos y la identificación entregada por el equipo.
El propietario técnico central es Gonzalo; la autoría queda en el registro.
Los originales de Descargas se conservan sin cambios. Tras revisar las 56 páginas, se redactaron las copias del punto 4 y de monitoreo que mostraban credenciales. El manifiesto conserva el hash original y el publicable; las revisiones inseguras se retiraron de Nextcloud.

## Ejecutar sobre esta instalación

Desde la raíz de `tp-Final-Gymbro`, comprobar que `NEXTCLOUD_ADMIN_PASSWORD` está definida en el `.env` privado.
No subir ese archivo ni incluir contraseñas en comandos o informes.

```bash
docker compose up -d --no-deps nextcloud
docker exec gymbro-nextcloud sh /docker-entrypoint-hooks.d/post-installation/01-setup-smartgymbro.sh --check
docker exec gymbro-nextcloud sh /docker-entrypoint-hooks.d/post-installation/01-setup-smartgymbro.sh
docker exec gymbro-nextcloud sh /docker-entrypoint-hooks.d/post-installation/01-setup-smartgymbro.sh --verify
```

El primer comando actualiza el montaje de informes y conserva el volumen existente.
El hook post-installation solo se dispara automáticamente en una instalación nueva;
reiniciar un contenedor ya instalado no ejecuta el aprovisionamiento por sí solo.

Configurar cada contraseña sin mostrarla en la terminal:

```bash
docker exec -it --user www-data gymbro-nextcloud php occ user:resetpassword gonzalo
# Repetir para facundo, aldo, rodrigo y sonia.
```

La cuenta `admin` de instalación mantiene sus privilegios. No se cambia su contraseña.
No se envían correos ni notificaciones externas durante esta preparación.

## Verificaciones y evidencias

`--check` valida los diez PDF y el manifiesto sin cargar ni modificar Nextcloud.
`--verify` comprueba las 24 comparticiones, sus destinatarios y permisos, los PDF cargados
y la ausencia de comparticiones inesperadas en el árbol gestionado. No sustituye pruebas de login.

Pruebas previas se ejecutan en un contenedor descartable, sin puertos publicados ni red externa:
instalación completa, segunda ejecución, SHA-256, lectura WebDAV de las seis áreas por cada integrante,
escritura permitida en el área propia/registro y rechazada en las demás, y rechazo de acceso anónimo.
Las pruebas de esa instancia no certifican automáticamente la instancia real.

Para cerrar el punto, guardar evidencias de la ejecución real, inicio de sesión de cada integrante,
lectura y escritura según la matriz y acceso anónimo rechazado. Cualquier actualización de informes
requiere revisar su contenido y actualizar los hashes del manifiesto. El script no inventa revisiones
ni fechas anteriores de los entregables.

## Cierre aplicado a la instancia real

Se aplicaron las cuentas y las seis áreas y se verificaron 30 combinaciones de usuario/carpeta con WebDAV, además del rechazo anónimo y de clave incorrecta (HTTP 401). Evidencias en `evidencias/verificacion-instancia-real.json` y en el área 06 de Nextcloud.

Los cinco integrantes tienen claves iniciales únicas en un archivo privado con permisos 0600 fuera de Git y Nextcloud. La cuenta admin no se modificó. Cada integrante debe cambiar su clave inicial.

`sincronizar-cierre.php` incorpora el paquete adicional de `informes/cierre`: informe de Gonzalo, editable, captura Trello y evidencias. La revisión 1.0 y la 1.1 del informe de administración se conservan por hash. El modo `--verify` también comprueba el paquete adicional. El archivo privado de contraseñas nunca se incluye en los montajes documentales.

## Documentación de la actualización

- [Informe breve de la actualización aplicada](INFORME-ACTUALIZACION.md).
- [Guía del repositorio y comandos de actualización](GUIA-REPOSITORIO.md).

Ambos documentos también se incorporan al área 06 de Nextcloud mediante el paquete de cierre.
