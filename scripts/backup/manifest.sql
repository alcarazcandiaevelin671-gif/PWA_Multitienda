-- Manifiesto de una copia de seguridad: lo que DEBE existir después de restaurarla.
-- Formato de salida (psql -At): tipo|nombre|valor
-- Se ejecuta sobre la base de producción al respaldar y sobre la base restaurada al verificar.

-- Filas por tabla (app + cuentas + registro de archivos)
SELECT 'filas|' || table_schema || '.' || table_name || '|' ||
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND (table_schema = 'public'
       OR (table_schema, table_name) IN (('auth', 'users'), ('auth', 'identities'), ('auth', 'mfa_factors'),
                                          ('storage', 'buckets'), ('storage', 'objects')))
ORDER BY 1;

-- Objetos de la base que no son datos pero son críticos (seguridad y lógica)
SELECT 'objetos|politicas_rls_public|' || count(*) FROM pg_policies WHERE schemaname = 'public';
SELECT 'objetos|funciones_public|' || count(*)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public';
SELECT 'objetos|triggers_public|' || count(*)
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal;
SELECT 'objetos|tablas_con_rls_public|' || count(*)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity;

-- Información (no se compara)
SELECT 'meta|version_postgres|' || current_setting('server_version');
SELECT 'meta|fecha_utc|' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
