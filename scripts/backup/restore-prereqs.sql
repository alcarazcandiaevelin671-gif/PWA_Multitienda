-- Prepara una base PostgreSQL vacía (no Supabase) para poder restaurar una copia y verificarla.
-- En un proyecto Supabase nuevo NO hace falta: ya trae estos roles, esquemas y extensiones.

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'anon', 'authenticated', 'service_role', 'authenticator', 'supabase_admin',
    'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user', 'supabase_realtime_admin',
    'supabase_replication_admin', 'supabase_read_only_user', 'pgbouncer', 'postgres'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END
$$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
