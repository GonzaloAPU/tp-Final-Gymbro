@echo off
cd /d "%~dp0"
title Cargador Automatico - Mantis SmartGymBro
echo ========================================================
echo  Importando usuarios, categorias y las 10 incidencias...
echo ========================================================
echo.

docker exec -i mantis-mysql-db mysql -u root -proot_password_seguro bugtracker < mantis_backup.sql

echo.
echo [OK] Todo el entorno de Mantis fue cargado con exito.
echo Ingresa a http://localhost:8089 (User: rodrigo_qa o administrator / Pass: admin1234)
echo.
pause

