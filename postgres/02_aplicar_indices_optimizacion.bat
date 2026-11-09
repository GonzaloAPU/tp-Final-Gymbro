@echo off
setlocal enabledelayedexpansion
title [02] SmartGymBro - Aplicador de Indices de Optimizacion
color 0E

echo =====================================================================
echo    [02] SMARTGYMBRO - APLICACION DE INDICES DE OPTIMIZACION (P5)
echo =====================================================================
echo.

:: Detectar directorio raiz del proyecto
for %%I in ("%~dp0..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

:: 1. Verificar si Docker esta corriendo
echo [1/3] Verificando estado de Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Docker Desktop no esta iniciado.
    pause
    exit /b 1
)

:: 2. Verificar que el contenedor de PostgreSQL este corriendo
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

:: 3. Aplicar los 8 indices de optimizacion
echo [3/3] Aplicando indices B-Tree, Covering y Parciales en PostgreSQL...
echo (Creando indices sobre las tablas maestras y 6.000.000 de pesajes)...
echo.

docker exec -i gymbro-postgres-primary psql -U smartgymbro_tp -d smartgymbro_tp < "%ROOT_DIR%\postgres\indices.sql"
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
echo 1. idx_peso_usuario_fecha_desc       : B-Tree Compuesto (C1 y C5)
echo 2. idx_peso_usuario_fecha_asc        : B-Tree Compuesto (C2)
echo 3. idx_peso_usuario_covering         : Covering Index INCLUDE (C3)
echo 4. idx_peso_parcial_categoria_pesada : Partial Index WHERE peso ^> 95 (C4)
echo 5. idx_peso_fecha_registro           : B-Tree Temporal (C6)
echo 6. idx_marcas_ejercicio_1rm          : B-Tree Compuesto 1RM (C7)
echo 7. idx_ejercicios_nombre             : B-Tree Simple (C7)
echo 8. idx_sesiones_completadas_calorias : Partial Index WHERE COMPLETED (C8)
echo.
echo Todas las consultas criticas de GymBro estan optimizadas.
echo =====================================================================
echo.
pause
