@echo off
setlocal enabledelayedexpansion
title [SmartGymBro] Restaurar Mantis Bug Tracker en tu Notebook
color 0B

echo ===============================================================================
echo        SMARTGYMBRO - RESTAURADOR COMPLETO DE MANTIS BUG TRACKER (PORTABLE)
echo ===============================================================================
echo.

:: -----------------------------------------------------------------
:: 0. DETECCION DINAMICA DE RUTAS RELATIVAS (PORTABLE PARA CUALQUIER NOTEBOOK)
:: -----------------------------------------------------------------
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: Subir dos niveles para encontrar la raiz del repositorio si esta en infra\incidencias
for %%I in ("%SCRIPT_DIR%\..\..") do set "ROOT_DIR=%%~fI"

:: Comprobar si existe docker-compose.yml en ROOT_DIR, sino buscar en el padre
if not exist "%ROOT_DIR%\docker-compose.yml" (
    for %%I in ("%SCRIPT_DIR%\..") do set "ROOT_DIR=%%~fI"
)

:: -----------------------------------------------------------------
:: 1. COMPROBAR DOCKER DESKTOP
:: -----------------------------------------------------------------
echo [1/4] Verificando que Docker Desktop este iniciado...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Docker Desktop no esta corriendo en esta notebook.
    echo Por favor inicia Docker Desktop y vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker Desktop esta activo.
echo.

:: -----------------------------------------------------------------
:: 2. LEVANTAR SERVICIOS DE MANTIS (SI ESTAN APAGADOS)
:: -----------------------------------------------------------------
echo [2/4] Verificando contenedores mantis-mysql-db y mantis-web-app...
docker ps --format "{{.Names}}" | findstr /i "mantis-mysql-db" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Levantando contenedores de Mantis desde el repositorio...
    cd /d "%ROOT_DIR%"
    docker compose up -d mantis-db mantis-web
    echo [INFO] Esperando inicializacion de MySQL...
    timeout /t 10 /nobreak >nul
) else (
    echo [OK] Los contenedores de Mantis ya estan en ejecucion.
)
echo.

:: -----------------------------------------------------------------
:: 3. ESPERAR A QUE MYSQL ACEPTE CONEXIONES
:: -----------------------------------------------------------------
echo [3/4] Comprobando disponibilidad de la base de datos...
:wait_mysql
docker exec -i mantis-mysql-db mysql -u root -proot_password_seguro -e "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ...esperando respuesta de MySQL en mantis-mysql-db...
    timeout /t 2 /nobreak >nul
    goto wait_mysql
)
echo [OK] Base de datos MySQL lista y accesible.
echo.

:: -----------------------------------------------------------------
:: 4. RESTAURAR DUMP SQL COMPLETO (USUARIOS, CATEGORIAS E INCIDENCIAS)
:: -----------------------------------------------------------------
echo [4/4] Restaurando mantis_backup.sql (Usuarios, Categorias e Incidencias del TP)...
if not exist "%SCRIPT_DIR%\mantis_backup.sql" (
    color 0C
    echo [ERROR] No se encontro el archivo mantis_backup.sql en:
    echo %SCRIPT_DIR%
    pause
    exit /b 1
)

docker exec -i mantis-mysql-db mysql -u root -proot_password_seguro bugtracker < "%SCRIPT_DIR%\mantis_backup.sql"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Fallo al inyectar el backup SQL en Mantis.
    pause
    exit /b 1
)

color 0A
echo.
echo ===============================================================================
echo [EXITO] MANTIS BUG TRACKER FUE RESTAURADO AL 100%% EN ESTA NOTEBOOK
echo ===============================================================================
echo.
echo Podes ingresar ahora mismo desde tu navegador en:
echo   ?? http://localhost:8089/
echo.
echo CREDENCIALES DISPONIBLES:
echo   - Administrador general:   administrator / root_password_seguro (o admin1234)
echo   - Rodrigo (QA y Soporte):  rodrigo_qa    / admin1234
echo   - Facundo (Base de Datos): facundo_db    / admin1234
echo   - Aldo (Frontend/DevOps):  aldo_front    / admin1234
echo   - Gonzalo (Arquitectura):  gonzalo_dev   / admin1234
echo   - Sonia (Automatizacion):  sonia_dev     / admin1234
echo.
echo ===============================================================================
echo.
pause
