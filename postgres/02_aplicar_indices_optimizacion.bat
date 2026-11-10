@echo off
setlocal enabledelayedexpansion
title [02] SmartGymBro - Aplicador de Indices de Optimizacion
color 0E

echo =====================================================================
echo    [02] SMARTGYMBRO - APLICACION DE INDICES DE OPTIMIZACION (P5)
echo    Tabla de Movimiento Principal: gymbro.series_realizadas (6M)
echo =====================================================================
echo.

:: -----------------------------------------------------------------
:: 0. DETECCION DINAMICA DE RUTAS RELATIVAS (PORTABLE PARA CUALQUIER PC)
:: -----------------------------------------------------------------
:: SCRIPT_DIR: Carpeta donde reside este .bat (siempre <REPO>\postgres)
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: ROOT_DIR: Raiz del repositorio (directorio padre de postgres)
for %%I in ("%SCRIPT_DIR%\..") do set "ROOT_DIR=%%~fI"

cd /d "%ROOT_DIR%"

:: -----------------------------------------------------------------
:: 1. VERIFICACION DE DOCKER DESKTOP
:: -----------------------------------------------------------------
echo [1/3] Verificando estado de Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Docker Desktop no esta iniciado en esta PC.
    pause
    exit /b 1
)

:: -----------------------------------------------------------------
:: 2. VERIFICACION DEL CONTENEDOR POSTGRESQL
:: -----------------------------------------------------------------
echo [2/3] Verificando contenedor PostgreSQL (gymbro-postgres-primary)...
docker exec gymbro-postgres-primary pg_isready -U smartgymbro_tp -d smartgymbro_tp >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] El contenedor PostgreSQL no esta respondiendo.
    echo Asegurate de haber ejecutado previamente [01_poblar_base_datos.bat].
    pause
    exit /b 1
)
echo [OK] PostgreSQL 17 esta activo y respondiendo.
echo.

:: -----------------------------------------------------------------
:: 3. APLICACION DE INDICES DE OPTIMIZACION
:: -----------------------------------------------------------------
echo [3/3] Aplicando indices B-Tree, Covering y Parciales en PostgreSQL...
echo (Creando indices sobre series_realizadas con 6.000.000 de registros y tablas asociadas)...
echo.

type "%SCRIPT_DIR%\indices.sql" | docker exec -i gymbro-postgres-primary psql -U smartgymbro_tp -d smartgymbro_tp
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Fallo al crear los indices en PostgreSQL.
    pause
    exit /b 1
)

echo.
echo =====================================================================
echo             INDICES CREADOS Y VERIFICADOS EN GYMBRO
echo =====================================================================
docker exec gymbro-postgres-primary psql -U smartgymbro_tp -d smartgymbro_tp -c "SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'gymbro' AND indexname LIKE 'idx_%%' ORDER BY tablename, indexname;"

color 0A
echo.
echo =====================================================================
echo [EXITO] TODOS LOS INDICES FUERON APLICADOS CON EXITO
echo.
echo 1. idx_series_ejercicio_set              : B-Tree Compuesto (C1)
echo 2. idx_series_peso_reps_fecha            : B-Tree Compuesto Sobrecarga (C2)
echo 3. idx_series_ejercicio_covering         : Covering Index INCLUDE (C3)
echo 4. idx_series_parcial_alta_carga         : Partial Index WHERE peso ^>= 100 (C4)
echo 5. idx_series_fecha_finalizacion         : B-Tree Temporal (C5)
echo 6. idx_ejercicios_realizados_ejercicio_id: B-Tree FK Join Catalogo (C6)
echo 7. idx_marcas_ejercicio_1rm              : B-Tree Compuesto 1RM (C7)
echo 8. idx_sesiones_completadas_calorias     : Partial Index WHERE COMPLETED (C8)
echo.
echo Todas las consultas criticas de GymBro estan optimizadas.
echo =====================================================================
echo.
pause
