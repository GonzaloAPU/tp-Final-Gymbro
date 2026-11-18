# Gymbro: Supabase + Render, paso a paso

Todo este trabajo vive en la rama `render`. La rama `codex/android` no se modifica.
La arquitectura final es **APK → Express en Render → PostgreSQL en Supabase**.
Conservamos las cuentas, contraseñas cifradas y permisos de Gymbro: no usamos Supabase Auth.

Esta guía describe la configuración de Supabase y Render usada por Gymbro AI.
Los secretos se configuran en el entorno del backend.

## Qué vas a aprender y crear

1. Un proyecto gratuito de Supabase con una base PostgreSQL.
2. Un esquema `gymbro` con 16 tablas, relaciones, índices y restricciones.
3. Un catálogo de 190 ejercicios oficiales.
4. Un usuario SQL que puede operar los datos, pero no modificar las tablas.
5. Una API Express desplegada en Render, conectada con TLS y certificados verificados.

El instalador crea una base **limpia**: no copia usuarios, fotos, pesos ni sesiones
anteriores. Las copias locales se conservan. Si querés migrar esas cuentas
más adelante, primero habrá que preparar una migración de datos, conservando sus UUID.

## 1. Crear el proyecto Supabase

Entrá a https://supabase.com/dashboard, creá un proyecto en una organización **Free**
y elegí un nombre como Gymbro. Guardá la contraseña del usuario administrador `postgres`.
Elegí una región cercana a tus usuarios y, si es posible, a la del backend.
Esperá a que termine de prepararse.

No publiques contraseñas, cadenas de conexión ni claves en GitHub o en el chat.
Los límites actuales del plan se consultan en https://supabase.com/pricing.

## 2. Crear las tablas y el catálogo

Abrí este archivo en tu editor:

`postgres/sql/01-bootstrap.sql`

Copiá su contenido completo al **SQL Editor** del proyecto nuevo y ejecutalo como
`postgres`. El resultado esperado es:

| tablas | ejercicios | usuarios |
| --- | --- | --- |
| 15 | 190 | 0 |

**Qué hace:** crea el esquema `gymbro`, sus tablas, claves foráneas, índices,
reglas de validación, protección contra ejercicios duplicados y el catálogo.
Todo ocurre en una transacción. Si encuentra un esquema `gymbro` existente,
aborta y no lo borra ni sobrescribe.

Las tablas aparecerán en Table Editor al seleccionar el esquema **gymbro**.
No agregues `gymbro` a los esquemas expuestos de Data API ni Realtime:
la app usará nuestro backend. El SQL retira permisos a `anon`, `authenticated`
y `service_role`; el esquema `public` y los esquemas internos de Supabase no se modifican.
Esto no sustituye los permisos por usuario que aplica Express.

## 3. Crear el usuario del backend

**Si ejecutaste el instalador antes de incorporar borrado lógico:** no repitas
`01-bootstrap.sql`. Ejecutá únicamente `postgres/sql/03-soft-delete.sql`
como `postgres`. Agrega `deleted_at` a diez tablas, conserva las filas e identificadores
y registra `20261022_soft_delete`. Se puede volver a ejecutar sin duplicar datos.
Si el usuario SQL ya existía, también se retira su permiso de borrado físico sobre
esas entidades. En instalaciones nuevas, `01-bootstrap.sql` ya incluye este cambio.

Abrí `postgres/sql/02-backend-role.sql` en una consulta nueva del SQL Editor.
Reemplazá `REEMPLAZAR_POR_UNA_CONTRASENA_ALEATORIA` por una contraseña nueva de al
menos 32 caracteres. Podés generar una cadena hexadecimal localmente con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Pegala solo en la consulta de Supabase y guardala en tu gestor de contraseñas.
**No guardes la copia editada del SQL en el repositorio.** Ejecutá la consulta como `postgres`.

**Qué hace:** crea `gymbro_backend`. Puede leer y escribir datos de las 14 tablas
funcionales; solo puede leer `schema_migrations`. No puede crear ni borrar tablas,
crear otras bases ni crear usuarios. Si ya existe, no cambia su contraseña.

## 4. Obtener la conexión correcta

En Supabase, abrí **Connect → Session pooler** y copiá la URI PostgreSQL.
Usamos **Session pooler, puerto 5432** para evitar necesitar el complemento IPv4.
No uses Transaction pooler (6543).

La URI de Connect suele traer el administrador `postgres.PROJECT_REF`. Reemplazá
ese usuario por `gymbro_backend.PROJECT_REF` y su contraseña por la del paso 3.
Conservá el host y el identificador exactos que muestra tu proyecto:

```text
postgresql://gymbro_backend.PROJECT_REF:CONTRASENA@HOST.pooler.supabase.com:5432/postgres
```

Si usás una contraseña con caracteres especiales, codificalos para una URL.
La contraseña hexadecimal del ejemplo evita ese problema.
No uses una URL `https://...supabase.co` ni una clave anon/service_role como DATABASE_URL:
son productos diferentes de Supabase.

## 5. Crear el Web Service de Render

En https://dashboard.render.com: **New → Web Service**, conectar GitHub y seleccionar
`GonzaloAPU/gymbro`. Si el repositorio privado no aparece, permitirle acceso a Render.

| Campo | Valor |
| --- | --- |
| Nombre | `gymbro-api` |
| Rama | `render` |
| Runtime | Node |
| Root Directory | Vacío: usar la raíz del repositorio |
| Build Command | `npm ci --omit=dev --workspace backend` |
| Start Command | `npm run start --workspace backend` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

También podés usar el archivo `render.yaml` mediante un Blueprint; declara un solo
servicio web, sin otra base de datos. Para el primer aprendizaje, el formulario manual
permite ver cada decisión.

## 6. Configurar las variables

En **Environment**, configurar:

| Variable | Valor |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `DB_CONNECTION_MODE` | `SUPABASE` |
| `DATABASE_URL` | La URI completa del paso 4 |
| `JWT_SECRET` | Otro secreto aleatorio de al menos 32 caracteres |
| `FRONTEND_URL` | `https://localhost` |
| `GEMINI_ENABLED` | `false` |

Generá JWT_SECRET con el mismo comando del paso 3, pero usá un valor distinto.
El Blueprint lo genera automáticamente. No reutilices la contraseña SQL.

Si ya habías creado el servicio con la configuración de Google, quitar
`CLOUD_SQL_INSTANCE`, `DB_NAME`, `DB_USER`, `GOOGLE_APPLICATION_CREDENTIALS`
y el archivo secreto de Google. El modo SUPABASE no los utiliza.

**TLS:** el backend exige cifrado y verificación del certificado. Si el certificado
de tu proyecto no está en las raíces de confianza de Node, descargá la CA desde
Database Settings de Supabase, agregala en Render como Secret File `supabase-ca.crt`
y configurá `DB_SSL_CA_FILE=/etc/secrets/supabase-ca.crt`.
No usar `rejectUnauthorized=false` ni `NODE_TLS_REJECT_UNAUTHORIZED=0`.

El pool del backend mantiene como máximo tres conexiones. El esquema `gymbro` se
selecciona al abrir cada sesión. Ni el APK ni GitHub reciben la contraseña SQL.

## 7. Desplegar y comprobar

Creá/desplegá el servicio. El build instala solo las dependencias del backend;
no compila Android. El arranque autentica con PostgreSQL antes de abrir HTTP.
No se ejecutan migraciones ni semillas automáticamente.

El mensaje esperado en Logs es `SmartGymBro API lista en puerto ...`.
Abrí `https://TU-SERVICIO.onrender.com/api/health`. Debe responder:

```json
{"status":"ok","service":"smartgymbro-api"}
```

Después, en la pantalla Conexión del APK, configurar `https://TU-SERVICIO.onrender.com`,
sin agregar `/api`. Registrá una cuenta ficticia, probá la bienvenida local y comprobá
que las rutinas y horarios persisten al cerrar sesión. En Table Editor → esquema gymbro
podrás ver los registros creados. No modificar hashes de contraseñas manualmente.

Render Free puede dormir tras inactividad; el primer acceso posterior puede tardar.
Esto no implica que la base haya perdido los datos. El plan gratuito de Supabase
también tiene cuotas y puede pausar proyectos inactivos.

## Verificación opcional desde tu PC

Para revisar Supabase sin tocar el `.env` local, creá un archivo ignorado por Git
llamado `backend/.env.supabase` con:

```dotenv
DB_CONNECTION_MODE=SUPABASE
DATABASE_URL=LA_URI_REAL_DEL_PASO_4
# DB_SSL_CA_FILE=C:/ruta/a/supabase-ca.crt
```

Desde la raíz del proyecto:

```powershell
node --env-file=backend/.env.supabase backend/scripts/check-supabase.js
```

Es una comprobación de solo lectura: valida tablas, catálogo, versiones y permisos;
no imprime la URI ni datos de las cuentas. No ejecutes migraciones con el usuario de
runtime: sus permisos están limitados a operar datos.

## Mantenimiento para desarrolladores

- `npm run supabase:sql`: regenera 01-bootstrap.sql desde los modelos y catálogo.
- `npm run supabase:test`: ejecuta el instalador en PostgreSQL embebido, sin cuenta ni red.
- `npm test`: pruebas de backend, frontend e instalador SQL.
- El instalador es para proyectos nuevos; actualizar una base existente exige una
  migración incremental. No borrar el esquema para aplicar un cambio de código.

### Borrado lógico

Usuarios, ejercicios, rutinas, bloques, prescripciones, sesiones, ejercicios/series
realizados, pesajes y marcas conservan `deleted_at` (`NULL` significa vigente).
Sequelize usa `paranoid`: `destroy()` archiva con UPDATE, las consultas normales
omiten las filas archivadas y `restore()` permite recuperarlas administrativamente.
El usuario SQL del backend no tiene DELETE sobre esas diez tablas.

Archivar el padre no elimina ni marca automáticamente sus hijos: así se conserva
el historial. Las consultas operativas validan al padre; un usuario archivado no
puede iniciar sesión ni usar JWT anteriores. El ranking filtra explícitamente
cuentas, ejercicios y ejecuciones anuladas. Los nombres de ejercicios y correos
siguen reservados; para reutilizar el mismo registro se debe restaurar, no crear
un duplicado. Los horarios y días de descanso pueden seguir reemplazándose;
schema_migrations y session_mutations conservan sus registros técnicos.

Este cambio prepara el esquema y el comportamiento del backend; no añade botones
de eliminación/restauración al APK. Una purga física es una operación administrativa
diferente y no se ejecuta desde el usuario SQL del backend.

Se verificaron las tablas, catálogo, restricciones, aislamiento de los roles públicos,
operaciones del usuario backend y rechazo de reinstalaciones. No se hizo un despliegue
real en Supabase/Render porque vos vas a crear los servicios y cargar las credenciales.

Fuentes oficiales:
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/api/securing-your-api
- https://render.com/docs/deploy-node-express-app
