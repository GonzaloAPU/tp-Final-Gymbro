#!/bin/bash
set -e

CONN_URL="$1"
TARGET_DB="smartgymbro_tp"

echo "=========================================================="
echo "[PATRONI POST-INIT] Bootstrap inicial del cluster"
echo "=========================================================="

# 1. Crear base de datos de la aplicacion si no existe
echo "[PATRONI POST-INIT] Verificando base de datos '$TARGET_DB'..."
psql "$CONN_URL" -tc "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DB'" | grep -q 1 || \
psql "$CONN_URL" -c "CREATE DATABASE $TARGET_DB;"

# 2. Conectar a la base de datos de destino y habilitar extensiones requeridas
psql "$CONN_URL" -d "$TARGET_DB" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" || true

# 3. Aplicar scripts SQL en /docker-entrypoint-initdb.d si existen
if [ -d /docker-entrypoint-initdb.d ]; then
  for sql_file in $(ls -1 /docker-entrypoint-initdb.d/*.sql 2>/dev/null | sort); do
    if [ -f "$sql_file" ]; then
      echo "[PATRONI POST-INIT] Aplicando: $(basename "$sql_file")..."
      psql "$CONN_URL" -d "$TARGET_DB" -f "$sql_file" || echo "[PATRONI POST-INIT] Aviso no critico al ejecutar $sql_file"
    fi
  done
fi

echo "=========================================================="
echo "[PATRONI POST-INIT] Inicializacion finalizada exitosamente."
echo "=========================================================="
