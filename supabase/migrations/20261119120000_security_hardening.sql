-- =====================================================================
-- Endurecimiento de seguridad de la base de datos
-- Hallazgos de la auditoría (19/11/2026) que corrige esta migración:
--   [CRÍTICO] Un cliente podía modificar su propia fila de usuarios, incluido
--             `rol` (escalada a administrador) y `activo`.
--   [ALTO]    Cualquier usuario registrado podía subir CUALQUIER archivo (HTML,
--             scripts, ejecutables, sin límite de tamaño) a los buckets públicos
--             `productos` y `tiendas-media`.
--   [MEDIO]   Un comerciante podía auto-aprobar su tienda cambiando `estado`
--             o `verificada` (no hay restricción a nivel de columna).
--   [MEDIO]   `tiendas-media` permitía listar sus archivos a anónimos.
--   [BAJO]    Funciones SECURITY DEFINER sin search_path fijo.
-- Referencias: OWASP Top 10 A01 (control de acceso), A04, A05; OWASP ASVS V4
-- (control de acceso), V12 (archivos); ISO/IEC 27002:2022 8.3, 8.15, 8.26.
-- Ejecutar completo en Supabase > SQL Editor. Es idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Helpers de rol (SECURITY DEFINER, search_path vacío)
-- ---------------------------------------------------------------------
-- Rol del JWT de la petición: 'anon', 'authenticated', 'service_role' o NULL
-- (NULL = conexión directa a la base: SQL Editor, migraciones, triggers de Auth).
CREATE OR REPLACE FUNCTION public.rol_peticion()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
$$;

CREATE OR REPLACE FUNCTION public.es_comerciante_o_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios AS u
    WHERE u.id = (SELECT auth.uid())
      AND u.activo = true
      AND lower(u.rol::text) IN ('comerciante', 'admin', 'administrador')
  );
$$;

REVOKE ALL ON FUNCTION public.es_comerciante_o_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_comerciante_o_admin() TO authenticated;

-- ---------------------------------------------------------------------
-- 1) [CRÍTICO] usuarios: nadie puede cambiarse el rol, reactivarse ni
--    cambiar su correo/id desde la API. Solo administradores, el servidor
--    (service_role) o conexiones directas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_campos_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rol_peticion text := public.rol_peticion();
BEGIN
  IF v_rol_peticion IS NULL OR v_rol_peticion = 'service_role' OR public.es_administrador_actual() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Autorregistro: solo como cliente, activo y con su propio id.
    IF NEW.id IS DISTINCT FROM (SELECT auth.uid()) THEN
      RAISE EXCEPTION 'Solo puedes crear tu propio perfil.' USING ERRCODE = '42501';
    END IF;
    IF lower(coalesce(NEW.rol::text, 'cliente')) <> 'cliente' THEN
      RAISE EXCEPTION 'No puedes asignarte ese rol.' USING ERRCODE = '42501';
    END IF;
    NEW.activo := true;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.rol IS DISTINCT FROM OLD.rol
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'No tienes permiso para modificar el rol, el correo o el identificador de la cuenta.'
      USING ERRCODE = '42501';
  END IF;
  -- Desactivar la propia cuenta está permitido; reactivarla no.
  IF OLD.activo IS DISTINCT FROM true AND NEW.activo = true THEN
    RAISE EXCEPTION 'Una cuenta desactivada solo puede reactivarla un administrador.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_usuario ON public.usuarios;
CREATE TRIGGER trg_proteger_campos_usuario
  BEFORE INSERT OR UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_usuario();

-- Registro de auditoría de cambios de rol/estado (ISO 27002 8.15: registro de eventos).
CREATE OR REPLACE FUNCTION public.auditar_cambio_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo THEN
    BEGIN
      INSERT INTO public.auditorias (usuario_id, accion, tabla_afectada, registro_id, datos_anteriores, datos_nuevos, fecha_hora)
      VALUES (
        (SELECT auth.uid()),
        'cambio_rol_o_estado',
        'usuarios',
        NEW.id::text,
        jsonb_build_object('rol', OLD.rol, 'activo', OLD.activo),
        jsonb_build_object('rol', NEW.rol, 'activo', NEW.activo),
        now()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Si la tabla de auditoría cambia de estructura, no bloquear la operación.
      RAISE WARNING 'No se pudo registrar la auditoría: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditar_cambio_usuario ON public.usuarios;
CREATE TRIGGER trg_auditar_cambio_usuario
  AFTER UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.auditar_cambio_usuario();

-- ---------------------------------------------------------------------
-- 2) [MEDIO] tiendas: el comerciante no puede aprobarse, verificarse,
--    cambiarse el plan ni transferir la tienda.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_campos_tienda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rol_peticion text := public.rol_peticion();
BEGIN
  IF v_rol_peticion IS NULL OR v_rol_peticion = 'service_role' OR public.es_administrador_actual() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.usuario_id IS DISTINCT FROM (SELECT auth.uid()) THEN
      RAISE EXCEPTION 'Solo puedes registrar tiendas a tu nombre.' USING ERRCODE = '42501';
    END IF;
    NEW.estado := 'pendiente';
    NEW.verificada := false;
    RETURN NEW;
  END IF;

  IF NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
     OR NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.verificada IS DISTINCT FROM OLD.verificada
     OR NEW.plan_tipo IS DISTINCT FROM OLD.plan_tipo
     OR NEW.fecha_fin_prueba IS DISTINCT FROM OLD.fecha_fin_prueba THEN
    RAISE EXCEPTION 'El estado, la verificación y el plan de la tienda solo los modifica un administrador.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tiendas' AND column_name = 'plan_tipo')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tiendas' AND column_name = 'fecha_fin_prueba') THEN
    DROP TRIGGER IF EXISTS trg_proteger_campos_tienda ON public.tiendas;
    CREATE TRIGGER trg_proteger_campos_tienda
      BEFORE INSERT OR UPDATE ON public.tiendas
      FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_tienda();
  ELSE
    RAISE WARNING 'tiendas no tiene plan_tipo/fecha_fin_prueba: revisar proteger_campos_tienda antes de activarlo.';
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 3) [ALTO] Almacenamiento: solo imágenes de hasta 5 MB y solo comerciantes
--    o administradores pueden subir/modificar/borrar en productos y tiendas-media.
-- ---------------------------------------------------------------------
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('productos', 'tiendas-media');

-- Políticas RESTRICTIVAS: se combinan con AND con las existentes, así que
-- bloquean aunque otra política permisiva lo permita.
DROP POLICY IF EXISTS media_solo_comerciantes_insert ON storage.objects;
CREATE POLICY media_solo_comerciantes_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id NOT IN ('productos', 'tiendas-media') OR (SELECT public.es_comerciante_o_admin()));

DROP POLICY IF EXISTS media_solo_comerciantes_update ON storage.objects;
CREATE POLICY media_solo_comerciantes_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (bucket_id NOT IN ('productos', 'tiendas-media') OR (SELECT public.es_comerciante_o_admin()))
  WITH CHECK (bucket_id NOT IN ('productos', 'tiendas-media') OR (SELECT public.es_comerciante_o_admin()));

DROP POLICY IF EXISTS media_solo_comerciantes_delete ON storage.objects;
CREATE POLICY media_solo_comerciantes_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (bucket_id NOT IN ('productos', 'tiendas-media') OR (SELECT public.es_comerciante_o_admin()));

-- [MEDIO] Listado de archivos: las imágenes se siguen viendo por su URL pública
-- (los buckets públicos no usan RLS para descargar), pero ya no se puede
-- enumerar el contenido del bucket.
DROP POLICY IF EXISTS media_sin_listado_publico ON storage.objects;
CREATE POLICY media_sin_listado_publico ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated, anon
  USING (bucket_id NOT IN ('productos', 'tiendas-media') OR (SELECT public.es_comerciante_o_admin()));

-- ---------------------------------------------------------------------
-- 4) [BAJO] search_path fijo en funciones SECURITY DEFINER del esquema public
--    (evita secuestro de funciones/tablas mediante search_path).
-- ---------------------------------------------------------------------
DO $fn$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS firma
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS c WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.firma);
    RAISE NOTICE 'search_path fijado en %', f.firma;
  END LOOP;
END
$fn$;

-- ---------------------------------------------------------------------
-- 5) Reporte de verificación (solo lectura)
-- ---------------------------------------------------------------------
-- 5a) Tablas de public SIN RLS (debe devolver 0 filas).
SELECT 'TABLA SIN RLS' AS hallazgo, c.relname AS objeto
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
UNION ALL
-- 5b) Funciones SECURITY DEFINER que cualquiera (anon) puede ejecutar: revisar que sean intencionales.
SELECT 'DEFINER EJECUTABLE POR ANON', p.oid::regprocedure::text
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')
UNION ALL
-- 5c) Políticas permisivas con condición siempre verdadera para escritura.
SELECT 'POLITICA ESCRITURA ABIERTA', schemaname || '.' || tablename || ' · ' || policyname
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND permissive = 'PERMISSIVE'
  AND (coalesce(qual, 'true') = 'true' AND coalesce(with_check, 'true') = 'true')
ORDER BY 1, 2;
