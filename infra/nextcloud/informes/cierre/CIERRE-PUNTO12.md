# Cierre del punto 12

Responsable: Gonzalo. Instancia real: gymbro-nextcloud.

Se aplicaron seis áreas compartidas y cinco cuentas del equipo. Se verificaron 30 combinaciones usuario/carpeta mediante autenticación WebDAV, lectura y escritura permitida o rechazada. Acceso anónimo y contraseña incorrecta: HTTP 401.

Diez informes del equipo centralizados y registrados por SHA-256. Se revisaron 56 páginas y se redactaron dos copias que mostraban credenciales explícitas o predeterminadas. Los originales permanecen fuera de Nextcloud. Se retiraron de esta instancia las copias históricas inseguras. La revisión no sustituye una auditoría de todos los servicios ni implica rotación de claves de PostgreSQL o Grafana.

Informe de Gonzalo: revisión 1.0 documentaba la preparación; revisión 1.1 documenta la aplicación y las comprobaciones reales. Ambas se identifican por hash; la actual y su editable están en el área 01.

Las claves iniciales se conservan exclusivamente en un archivo privado 0600 fuera de Git y Nextcloud. No se incluyen aquí. Cada integrante debe reemplazar su clave inicial. La cuenta admin conserva su contraseña.

Evidencias: verificacion-instancia-real.json y REVISION-SEGURIDAD.json. Las ocho actividades quedan implementadas y comprobadas en el alcance de esta práctica local.
