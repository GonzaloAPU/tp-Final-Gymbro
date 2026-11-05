# Descripciones y tutoriales

Los 190 ejercicios oficiales tienen una descripción breve propia en `backend/src/data/exercise-guides.js`, asociada por nombre exacto de variante. No contienen cargas ni tratamientos. Los videos se guardan únicamente como URL: no hay archivos, reproductores incrustados ni descargas.

Estado de los videos: 190 enlaces directos a Shorts localizados en resultados públicos de YouTube y asociados por correspondencia de título y variante, el 26 de octubre de 2026. `backend/src/data/exercise-videos.json` conserva URL, título, fecha y alcance de la revisión. No se reprodujeron íntegramente los 190 videos ni se auditó profesionalmente su técnica: la revisión audiovisual sigue pendiente. Algunos están en inglés. TikTok no devolvió resultados accesibles. No se cargaron páginas de búsqueda, perfiles ni IDs inventados. Para cambiar un enlace, editar el registro correspondiente y regenerar los SQL mediante `npm run supabase:sql`. La carga incremental conserva los enlaces existentes, por lo que reemplazar uno ya cargado requiere una actualización explícita de ese ejercicio.

En Supabase existente ejecutar `postgres/sql/06-exercise-guides.sql` como postgres. Agrega las columnas si faltan y completa campos vacíos solo de ejercicios oficiales. Respeta descripciones y enlaces ya cargados, no duplica ejercicios ni modifica usuarios, rutinas o sesiones. El resultado final informa cuántas descripciones y videos hay realmente. En instalaciones administradas por migraciones, `npm run db:migrate --workspace backend` aplica el mismo cambio. No ejecutar el instalador 01-bootstrap sobre una base existente.

El modelo devuelve `description` y `videoUrl` en catálogo y rutinas. Durante el entrenamiento, «Cómo hacer este ejercicio» muestra la descripción. El enlace «Ver tutorial en YouTube» o «Ver tutorial en TikTok» solo aparece para URLs directas del dominio permitido y abre una pestaña externa. La caché de rutinas se renueva en segundo plano; el cliente también debe actualizarse para mostrar la ayuda.

Una URL localizada hoy puede dejar de funcionar o pedir acceso al proveedor más adelante. La descripción se conserva aunque el video no esté disponible.
