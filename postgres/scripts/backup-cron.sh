#!/bin/sh
set -e

mkdir -p /backups

echo "================================================================="
echo "[BACKUP SERVICE] Servicio de backups automaticos de SmartGymBro"
echo "================================================================="

while true; do
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="/backups/smartgymbro_backup_${TIMESTAMP}.dump"
  
  echo ""
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando pg_dump de la base de datos '${PGDATABASE}'..."
  pg_dump -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -F c -b -v -f "${BACKUP_FILE}"
  
  if [ -f "${BACKUP_FILE}" ]; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup generado exitosamente: ${BACKUP_FILE} (${SIZE})"
  else
    echo "[ERROR] El archivo de backup no fue generado."
  fi
  
  # Politica de rotacion: conservar los ultimos 7 respaldos
  ls -1t /backups/smartgymbro_backup_*.dump 2>/dev/null | tail -n +8 | xargs -r rm -f
  
  echo "[BACKUP SERVICE] Proximo backup programado en 12 horas."
  sleep 43200 &
  wait $!
done
