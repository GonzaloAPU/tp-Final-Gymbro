@echo off
setlocal enabledelayedexpansion
title [01] SmartGymBro - Poblador de Base de Datos
color 0B

echo =====================================================================
echo       [01] SMARTGYMBRO - POBLAMIENTO COMPLETO DE BASE DE DATOS
echo            (20.000 Usuarios + 6.000.000 Pesajes + Actividad)
echo =====================================================================
echo.

:: Detectar directorio raiz del proyecto
for %%I in ("%~dp0..") do set "ROOT_DIR=%%~fI"
cd /d "%ROOT_DIR%"

:: 1. Verificar si Docker esta corriendo
echo [1/5] Verificando estado de Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Docker Desktop no esta iniciado o no responde.
    echo Por favor inicia Docker Desktop y vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker esta en ejecucion.
echo.

:: 2. Verificar o levantar contenedor PostgreSQL
echo [2/5] Verificando estado de PostgreSQL 17...
docker exec gymbro-postgres-primary pg_isready -U smartgymbro_tp -d smartgymbro_tp >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PostgreSQL 17 - gymbro-postgres-primary - ya esta activo y saludable en el puerto 55433.
    goto pg_ready
)

echo Levantando servicios en Docker [PostgreSQL 17 + pgAdmin]...
docker compose up -d postgres
if %errorlevel% neq 0 (
    docker compose --env-file "%ROOT_DIR%\postgres\.env" -f "%ROOT_DIR%\postgres\compose.yaml" up -d
)

:: Esperar a que PostgreSQL este listo
echo Esperando a que PostgreSQL acepte conexiones...
:wait_pg
timeout /t 2 /nobreak >nul
docker exec gymbro-postgres-primary pg_isready -U smartgymbro_tp -d smartgymbro_tp >nul 2>&1
if %errorlevel% neq 0 (
    echo ...esperando inicializacion de PostgreSQL...
    goto wait_pg
)
echo [OK] PostgreSQL 17 esta listo y saludable en el puerto 55433.

:pg_ready
echo.

:: 3. Verificar dependencias de Node.js en backend
echo [3/5] Verificando dependencias de Node.js...
if not exist "%ROOT_DIR%\node_modules" (
    echo Instalando dependencias del proyecto...
    cd /d "%ROOT_DIR%"
    call npm install
)
echo [OK] Dependencias de Node.js verificadas.
echo.

:: 4. Ejecutar inyeccion de 20.000 usuarios y 6.000.000 de pesajes
echo [4/5] Ejecutando seed masivo de 20.000 usuarios y 6.000.000 de pesajes...
echo (Este proceso toma aproximadamente 1 a 2 minutos)...
echo.
node "%ROOT_DIR%\postgres\seed-6m.mjs"
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Fallo durante la ejecucion de seed-6m.mjs.
    pause
    exit /b 1
)
echo.

:: 5. Ejecutar inyeccion de actividad (rutinas, sesiones, series, marcas)
echo [5/5] Ejecutando seed de actividad y entrenamientos para dar vida a la app...
node "%ROOT_DIR%\postgres\seed-actividad.mjs"
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Fallo durante la ejecucion de seed-actividad.mjs.
    pause
    exit /b 1
)
echo.

:: Verificacion final
echo =====================================================================
echo                VERIFICACION DEL ESTADO DE GYMBRO
echo =====================================================================
node "%ROOT_DIR%\postgres\verificar.mjs"
echo.

color 0A
echo =====================================================================
echo [EXITO] BASE DE DATOS DE SMARTGYMBRO POBLADA Y VIVA AL 100%%
echo.
echo - 20.000 usuarios activos (nombres reales, gimnasios y disciplinas)
echo - 6.000.000 de registros en historial_peso_corporal (996 MB)
echo - 2.000 rutinas y 6.000 dias de entrenamiento
echo - 10.000 sesiones de entrenamiento y 120.000 series
echo - 5.000 marcas de fuerza 1RM para leaderboards
echo.
echo Siguiente paso recomendado:
echo Ejecutar [02_aplicar_indices_optimizacion.bat] para indexar la base.
echo =====================================================================
echo.
pause
