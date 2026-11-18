# Guía del repositorio para actualizar Nextcloud

Esta guía actualiza la documentación, las cuentas y los permisos de SmartGymBro.
No realiza una actualización de versión de Nextcloud. Los comandos se ejecutan
desde la raíz del repositorio `tp-Final-Gymbro`.

## Archivos necesarios

| Ruta | Función |
|---|---|
| `docker-compose.yml` | Servicio Nextcloud del proyecto integrado. |
| `infra/nextcloud/compose.yaml` | Definición alternativa del módulo; no levantar ambas a la vez. |
| `infra/nextcloud/hooks/post-installation/01-setup-smartgymbro.sh` | Entrada del aprovisionamiento. |
| `infra/nextcloud/hooks/post-installation/setup-smartgymbro.php` | Cuentas, carpetas, permisos y catálogo de diez informes. |
| `infra/nextcloud/hooks/post-installation/sincronizar-cierre.php` | Informe de Gonzalo y paquete adicional de cierre. |
| `infra/nextcloud/informes/manifest.json` | Responsable, destino y SHA-256 de cada informe del equipo. |
| `infra/nextcloud/informes/cierre/manifest.json` | Archivos adicionales y revisiones del cierre. |
| `infra/nextcloud/evidencias/` | Resultados documentados de las pruebas reales. |

## Preparar el entorno

Tener Docker y Docker Compose disponibles. Definir `NEXTCLOUD_ADMIN_PASSWORD` en el
`.env` privado de la raíz antes de usar Compose; no incluir su valor en Git ni en
la documentación. La imagen ya incluye PHP y `occ`.

Conservar un respaldo reciente del volumen `nextcloud_data` antes de cambios
administrativos. Mantener juntos los scripts, PDF publicables y manifiestos del
mismo estado del repositorio. Usar únicamente copias revisadas de los informes.

## Aplicar la actualización

```bash
# Validar la definición sin imprimir las variables resueltas.
docker compose config --quiet

# Actualizar el contenedor y sus montajes conservando el volumen.
docker compose up -d --no-deps nextcloud

# Revisar el estado del servicio.
docker exec --user www-data gymbro-nextcloud php occ status

# Validar los diez informes y sus hashes sin modificar Nextcloud.
docker exec gymbro-nextcloud sh /docker-entrypoint-hooks.d/post-installation/01-setup-smartgymbro.sh --check

# Aplicar cuentas, carpetas, informes, permisos y paquete de cierre.
docker exec gymbro-nextcloud sh /docker-entrypoint-hooks.d/post-installation/01-setup-smartgymbro.sh

# Verificar el contenido cargado y las comparticiones.
docker exec gymbro-nextcloud sh /docker-entrypoint-hooks.d/post-installation/01-setup-smartgymbro.sh --verify
```

Acceso local: [Nextcloud](http://localhost:8081).
El hook se ejecuta automáticamente solo en una instalación nueva. En una instancia
existente hay que invocarlo manualmente: un reinicio por sí solo no lo aplica.
No usar `docker compose down -v`, porque elimina los volúmenes persistentes.

La ejecución repetida conserva las contraseñas existentes y evita duplicar las
comparticiones. Los PDF distintos reemplazan el contenido vigente y conservan
revisiones. Los documentos técnicos ya existentes no se sobrescriben automáticamente.
Los fallos no implican una reversión completa: corregir la causa y volver a ejecutar.

## Gestionar las cuentas

El script crea las cuentas faltantes con claves aleatorias descartadas; no genera
un archivo de contraseñas. En una instalación nueva, establecer una clave personal
mediante el panel administrativo o el comando interactivo:

```bash
docker exec -it --user www-data gymbro-nextcloud php occ user:resetpassword gonzalo
```

Repetir para `facundo`, `aldo`, `rodrigo` y `sonia` cuando corresponda. En esta instancia
las claves iniciales ya fueron asignadas por separado y guardadas fuera del repositorio.
No copiar ese archivo a `informes/`, a Nextcloud ni a las evidencias.

## Actualizar los informes

1. Revisar texto e imágenes para detectar credenciales. Si hay secretos, preparar una
   copia realmente redactada; una franja superpuesta no elimina el contenido del PDF.
2. Sustituir la copia publicable en `infra/nextcloud/informes/` y calcular su huella:

   ```bash
   sha256sum 'infra/nextcloud/informes/Informe_Tecnico_Punto4.pdf'
   ```

3. Actualizar `sha256` en la entrada correspondiente de `manifest.json`. Conservar
   responsable y carpeta. Si hubo redacción, documentar el hash original y la revisión.
4. Para archivos del paquete de cierre, actualizar su propio manifiesto. Comprobar
   que las copias montadas sean legibles por `www-data`; no hacer públicas las credenciales.
5. Ejecutar `--check`, aplicar el script y ejecutar `--verify`.

El catálogo principal exige exactamente diez PDF. Añadir o retirar informes de ese
catálogo requiere adaptar también su validación. Los archivos adicionales del cierre
se gestionan mediante `informes/cierre/manifest.json`.

**Si se descubre un secreto ya cargado**, reemplazar el archivo no basta: sus revisiones
anteriores pueden conservarlo. Revisar y retirar únicamente las copias inseguras,
registrar la intervención y evaluar la rotación de la credencial afectada. El script
no elimina automáticamente esas revisiones.

## Verificar y guardar evidencias

`--verify` comprueba los diez PDF, las 24 comparticiones de los cuatro integrantes,
sus permisos y los archivos adicionales del cierre. No ejecuta una prueba nueva de login.
Después de cambiar usuarios o permisos, comprobar con cada cuenta:

- Lectura de las seis áreas.
- Edición del área propia y del registro; rechazo en las demás. Gonzalo administra todas.
- Rechazo de acceso sin credenciales y con clave incorrecta.

Guardar una evidencia nueva con fecha e instancia; no presentar resultados anteriores
como si fueran una ejecución nueva. Referencia de la comprobación ya realizada:
`infra/nextcloud/evidencias/verificacion-instancia-real.json`.

## Incorporar los cambios a Git

```bash
git status --short
git diff --check
git diff -- docker-compose.yml infra/nextcloud/

# Agregar únicamente los archivos relacionados, después de revisarlos.
git add docker-compose.yml infra/nextcloud/
git diff --cached --stat
```

Revisar también los archivos nuevos y los PDF antes de confirmar el commit.
Excluir `.env`, claves privadas, contraseñas iniciales, datos del volumen y respaldos
que contengan secretos. Esta guía no ejecuta commits ni publica cambios en GitHub.

## Problemas frecuentes

| Mensaje o situación | Acción |
|---|---|
| Falta `/opt/project-reports/manifest.json` | Actualizar el servicio con Compose y comprobar el montaje de `informes/`. |
| Hash distinto | Revisar el archivo; actualizar el manifiesto solo después de aprobar su contenido. |
| Permiso de lectura denegado | Revisar los permisos de la copia documental montada, sin ampliar los de los archivos de secretos. |
| Cuenta ajena o compartición no autorizada | Revisar manualmente el destinatario y los permisos; el script se detiene sin eliminarlos automáticamente. |
| El cambio no aparece tras reiniciar | Ejecutar manualmente el script y luego `--verify`. |

Resumen de la intervención realizada: [informe de actualización](INFORME-ACTUALIZACION.md).
