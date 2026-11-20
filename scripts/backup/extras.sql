-- Genera (psql -At) el SQL de lo que vive FUERA del esquema public y no entra en public.dump:
--   * triggers sobre auth.users (p. ej. el que crea el perfil en public.usuarios al registrarse)
--   * políticas RLS de storage.objects (quién puede subir/ver archivos)
--   * configuración de los buckets (público, tamaño máximo, tipos permitidos)
-- El resultado (extras.sql dentro de la copia) se aplica al final de una restauración.

SELECT '-- Triggers de auth.users';
SELECT format('DROP TRIGGER IF EXISTS %I ON auth.users;', t.tgname) || E'\n' || pg_get_triggerdef(t.oid) || ';'
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT '-- Políticas de storage.objects';
SELECT format('DROP POLICY IF EXISTS %I ON storage.objects;', policyname) || E'\n' ||
       format('CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s%s%s;',
              policyname, permissive, cmd,
              (SELECT string_agg(quote_ident(r), ', ') FROM unnest(roles) AS r),
              coalesce(' USING (' || qual || ')', ''),
              coalesce(' WITH CHECK (' || with_check || ')', ''))
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

SELECT '-- Configuración de buckets';
SELECT format(
  'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (%L, %L, %s, %s, %s) '
  || 'ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;',
  id, name, CASE WHEN public THEN 'true' ELSE 'false' END, coalesce(file_size_limit::text, 'NULL'),
  coalesce(quote_literal(allowed_mime_types::text) || '::text[]', 'NULL'))
FROM storage.buckets
ORDER BY id;
