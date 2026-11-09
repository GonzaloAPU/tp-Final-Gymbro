-- CONFIGURACION DE REPLICACION STREAMING NATIVA 

-- 1. Crear rol de replicacion si no existe
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replicator') THEN
      CREATE ROLE replicator WITH REPLICATION LOGIN ENCRYPTED PASSWORD 'replicator_password123';
   END IF;
END
$$;

-- 2. Crear slot fisico de replicacion para el nodo Standby
SELECT pg_create_physical_replication_slot('standby_slot_1')
WHERE NOT EXISTS (
    SELECT 1 FROM pg_replication_slots WHERE slot_name = 'standby_slot_1'
);
