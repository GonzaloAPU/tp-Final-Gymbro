# Revisión funcional — 05/11/2026

- Backend: 226 pruebas aprobadas.
- Frontend: 162 pruebas node:test aprobadas, más verificadores de flujos.
- SQL: 31 pruebas aprobadas en PostgreSQL embebido.
- Estructura modular, TypeScript y compilación: correctos.
- PostgreSQL 17 en Docker real: 16 tablas en español, 190 ejercicios y cero usuarios de prueba persistidos.
- Prueba HTTP con PostgreSQL real: registro, ingreso, perfil, permisos, catálogo con descripciones/videos, semana local, aceptación, serie, cierre, historial de peso, récords y ranking. Base temporal eliminada al terminar.
- pgAdmin: inicio corregido y respuesta HTTP 302 de acceso comprobada en http://127.0.0.1:5051/.
- Git: entrega sin commits ni ramas históricas ni remoto. El equipo crea su primer commit y después develop/feature.

## Límites

La revisión comprueba los flujos listados; no garantiza ausencia total de errores. Gemini y EmailJS están desactivados para no usar credenciales, cuotas ni enviar mensajes. La recuperación devuelve 503 mientras el correo no está configurado: es el comportamiento esperado. Los tests de recuperación verifican tokens, vencimiento y uso único con transporte simulado.

La réplica de PostgreSQL, 6 millones de registros, contenedores de aplicación, CI/CD, monitoreo, n8n, Mantis, Nextcloud y túnel siguen siendo tareas pendientes del equipo. La interfaz compiló y pasó sus pruebas automatizadas; no se realizó una revisión visual completa en cada dispositivo.

## Comprobación después del reparto

Se ensamblaron las entregas de Aldo, Facundo, Sonia, Rodrigo y Gonzalo sin rutas duplicadas. La copia integracion-local pasó nuevamente 226 pruebas backend, 162 frontend y 31 SQL, revisión de tipos, compilación y prueba HTTP con PostgreSQL real. Las entregas por persona no contienen archivos .env ni historial Git. Las seis ramas previstas son main, develop, feature/aldo, feature/facundo, feature/sonia y feature/rodrigo; el equipo las crea desde su primer commit compartido.
