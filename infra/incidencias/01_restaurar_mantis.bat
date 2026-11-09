@echo off
setlocal enabledelayedexpansion
title SmartGymBro - Restaurar Incidencias Mantis
color 0B

echo =====================================================================
echo       SMARTGYMBRO - RESTAURACION DE INCIDENCIAS MANTIS BUG TRACKER
echo =====================================================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando que el contenedor de base de datos de Mantis este activo...
docker ps --format "{{.Names}}" | findstr /i "mantis-mysql-db" >nul
if %errorlevel% neq 0 (
    echo [INFO] Levantando contenedor de Mantis...
    docker compose up -d
    echo Esperando inicializacion de MySQL...
    timeout /t 10 /nobreak >nul
)

echo [2/3] Restaurando dump SQL con las 10 incidencias del TP...
docker exec -i mantis-mysql-db mysql -u mantis_user -pmantis_password_seguro bugtracker < "%~dp0mantis_backup.sql"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] No se pudo restaurar el archivo mantis_backup.sql.
    echo Asegurate de que el contenedor mantis-mysql-db este corriendo.
    pause
    exit /b 1
)

color 0A
echo.
echo =====================================================================
echo [EXITO] 10 Incidencias restauradas exitosamente en Mantis.
echo.
echo Podes ingresar a Mantis en: http://localhost:8089
echo Usuario por defecto: administrator / root (o mantis_user)
echo =====================================================================
echo.
pause
