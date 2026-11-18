@echo off
title SmartGymBro - Lanzador de Interfaces Graficas
color 0B

echo ===============================================================================
echo                SMARTGYMBRO - PANEL DE CONTROL Y ACCESO WEB                    
echo            Materia: Herramientas Informaticas Avanzadas (HIA 2026)             
echo ===============================================================================
echo.
echo Abriendo las interfaces graficas en el navegador predeterminado...
echo.

start "" "http://localhost:4300"
start "" "http://localhost:7000"
start "" "http://localhost:5051"
start "" "http://localhost:3001"
start "" "http://localhost:9090"
start "" "http://localhost:5678"
start "" "http://localhost:8089"
start "" "http://localhost:8081"
start "" "http://localhost:8080"

echo -------------------------------------------------------------------------------
echo SERVICIO                     URL                       USUARIO / PASSWORD
echo -------------------------------------------------------------------------------
echo 1. SmartGymBro App (Front)   http://localhost:4300     (Aplicacion Web Atletas)
echo 2. HAProxy Cluster HA (Web)  http://localhost:7000     (Dashboard Estadisticas Patroni)
echo    * AVISO: Los puertos 5000 y 5001 son TCP para la BD, no son paginas web.
echo 3. pgAdmin 4 PostgreSQL      http://localhost:5051     admin@smartgymbro.com / pgadmin_secure_pass_2026
echo    * Clave BD (smartgymbro_tp): admin123
echo 4. Grafana Dashboards        http://localhost:3001     admin / admin
echo 5. Prometheus Metricas       http://localhost:9090     (Acceso Directo Sin Login)
echo 6. n8n Automatizacion        http://localhost:5678     admin@gymbro.tp / Q2OoTrGJHVosB9f1Aa1
echo 7. Mantis Bug Tracker        http://localhost:8089     administrator / admin1234 (o cualquier miembro / admin1234)
echo 8. Nextcloud Documental      http://localhost:8081     aldo / SmartGym2026! (o gonzalo)
echo 9. cAdvisor Docker           http://localhost:8080     (Metricas Contenedores)
echo -------------------------------------------------------------------------------
echo.
echo [OK] Todas las pestanas se han abierto correctamente.
echo Deja esta ventana abierta como referencia rapida de contrasenas para la defensa.
echo.
pause
