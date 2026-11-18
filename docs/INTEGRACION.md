# Ramas vigentes

feature/aldo, feature/facundo, feature/sonia y feature/rodrigo se integran en develop; la entrega validada pasa a main. Consultar FLUJO-GIT.md.

# Ensamble en develop

1. Cada integrante abre PR de su feature hacia develop con pruebas y evidencias. Gonzalo revisa.
2. Facundo mantiene postgres/compose.yaml; Aldo crea infra/app/compose.yaml y Dockerfiles con contexto de construcción en la raíz para poder copiar shared/ y los manifests de workspaces.
3. Sonia mantiene infra/monitoring/compose.yaml e infra/n8n/compose.yaml; Rodrigo, infra/incidencias/compose.yaml; Gonzalo, infra/nextcloud/compose.yaml.
4. Gonzalo consolida la configuración en un docker-compose.yml maestro dentro de develop. No copiar archivos .env de compañeros; usar plantillas y secretos locales.
5. Clonar una copia limpia, ejecutar npm ci y probar el comando único del stack que se defina durante el ensamble. Mantener main hasta aprobar esa prueba.
6. Registrar evidencias de replicación, fallo del primario, recuperación, monitoreo y flujos. El solo hecho de crear ramas no demuestra integración funcional.

## Puertos reservados para coordinar el equipo

| Servicio | Puerto del host |
|---|---|
| Frontend de desarrollo | 4300 |
| API | 3100 |
| PostgreSQL del TP | 55433 |
| pgAdmin | 5051 |
| Grafana propuesto | 3001 |
| Prometheus propuesto | 9090 |
| cAdvisor propuesto | 8080 |
| n8n propuesto | 5678 |
| Mantis propuesto | 8082 |
| Nextcloud propuesto | 8081 |

Los puertos de las herramientas pendientes son acuerdos iniciales, no servicios ya instalados. Los puertos actuales del TP son distintos de los habituales del Gymbro original para que puedan coexistir.

## Evidencias mínimas por PR

Qué se modificó, comando de validación, resultado, captura o informe cuando corresponda, dependencias sobre otro módulo y forma de volver atrás sin borrar datos.
