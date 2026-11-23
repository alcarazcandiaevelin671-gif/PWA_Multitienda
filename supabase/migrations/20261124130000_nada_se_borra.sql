-- =====================================================================
-- NADA SE BORRA: baja lógica en TODAS las tablas de `public`
--
-- Generaliza lo que ya se hizo con productos (20261124120000):
--   1) Cada tabla tiene `eliminado_en` (cuándo) y `eliminado_por` (quién).
--   2) Trigger `trg_baja_logica` (BEFORE DELETE): un DELETE —desde la app, la API
--      con clave secreta o SQL— se convierte en "eliminado_en = ahora".
--      La fila sigue en la base; en los logs aparece como DELETE "BAJA LÓGICA".
--   3) Política RLS RESTRICTIVA "Ocultar registros dados de baja": lo dado de baja
--      deja de verse en la app sin tocar ninguna consulta.
--      Excepción: el dueño de una tienda y los administradores siguen viendo sus
--      productos eliminados (para restaurarlos).
--   4) TRUNCATE (vaciar tablas) queda bloqueado.
--   5) Los logs (`auditorias`) son inalterables: no se pueden modificar, borrar
--      ni vaciar, y se elimina la función de limpieza auditoria_limpiar().
--
-- Únicas excepciones (borrado físico):
--   - Borrar una cuenta de acceso (auth.users) desde Supabase o al revertir un
--     registro fallido: la base borra en cascada lo que dependía de ella
--     (y si la cuenta tiene pedidos/ventas/facturas, la base lo impide).
--   - Un administrador de la base que lo pida a propósito dentro de una
--     transacción: SET LOCAL app.borrado_fisico = 'on';
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Corrección: el log de estructura fallaba al borrar FUNCIONES (no tienen
--    object_name). Ahora usa el nombre completo del objeto. Va primero para que
--    los DROP de esta misma migración queden registrados.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auditoria_registrar_ddl()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ctx jsonb;
  r record;
BEGIN
  v_ctx := public.auditoria_contexto();
  IF TG_EVENT = 'sql_drop' THEN
    -- original: solo lo que se borró explícitamente (no los tipos internos de una tabla borrada).
    FOR r IN SELECT * FROM pg_event_trigger_dropped_objects() WHERE schema_name = 'public' AND original AND NOT is_temporary LOOP
      INSERT INTO public.auditorias (accion, operacion, esquema, tabla_afectada, objeto, comando_sql,
                                     usuario_id, usuario_email, usuario_rol, rol_bd, origen, ip, fecha_hora)
      VALUES ('DROP ' || upper(r.object_type), 'DDL', r.schema_name,
              coalesce(r.object_name, nullif(split_part(r.object_identity, '.', 2), ''), r.object_identity, r.object_type),
              r.object_identity,
              left(current_query(), 4000), NULLIF(v_ctx ->> 'usuario_id', '')::uuid, v_ctx ->> 'usuario_email',
              v_ctx ->> 'usuario_rol', v_ctx ->> 'rol_bd', v_ctx ->> 'origen', v_ctx ->> 'ip', clock_timestamp());
    END LOOP;
  ELSE
    FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE schema_name = 'public' LOOP
      INSERT INTO public.auditorias (accion, operacion, esquema, tabla_afectada, objeto, comando_sql,
                                     usuario_id, usuario_email, usuario_rol, rol_bd, origen, ip, fecha_hora)
      VALUES (r.command_tag, 'DDL', r.schema_name,
              coalesce(nullif(split_part(r.object_identity, '.', 2), ''), r.object_identity, r.object_type),
              r.object_identity,
              left(current_query(), 4000), NULLIF(v_ctx ->> 'usuario_id', '')::uuid, v_ctx ->> 'usuario_email',
              v_ctx ->> 'usuario_rol', v_ctx ->> 'rol_bd', v_ctx ->> 'origen', v_ctx ->> 'ip', clock_timestamp());
    END LOOP;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear un cambio de estructura (ni las migraciones de Supabase) por la auditoría.
  RAISE WARNING 'Auditoría DDL no registrada: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.auditoria_registrar_ddl() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1) Función genérica de baja lógica
--    Recibe como argumentos las columnas de la clave primaria de la tabla.
--    SECURITY DEFINER: el DELETE ya pasó las políticas RLS (solo se puede dar de
--    baja lo que el usuario podía borrar); la marca se hace sin volver a filtrar.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.baja_logica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb := to_jsonb(OLD);
  v_where text;
BEGIN
  -- Cascada desde otra tabla (p. ej. al borrar la cuenta de acceso) o borrado físico explícito.
  IF pg_trigger_depth() > 1 OR coalesce(current_setting('app.borrado_fisico', true), '') = 'on' THEN
    RETURN OLD;
  END IF;

  -- Ya estaba dado de baja: no hacer nada.
  IF v_old ->> 'eliminado_en' IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT string_agg(format('%I::text = %L', columna, v_old ->> columna), ' AND ')
  INTO v_where
  FROM unnest(TG_ARGV) AS columna;

  EXECUTE format(
    'UPDATE %I.%I SET eliminado_en = now(), eliminado_por = auth.uid() WHERE %s',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, v_where
  );
  RETURN NULL; -- cancela el borrado real
END;
$$;
REVOKE ALL ON FUNCTION public.baja_logica() FROM PUBLIC, anon, authenticated;

-- 2) Bloquear TRUNCATE (vaciar tablas completas)
CREATE OR REPLACE FUNCTION public.bloquear_truncate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('app.borrado_fisico', true), '') = 'on' THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'No se permite vaciar la tabla %: en este sistema los datos nunca se borran.', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
REVOKE ALL ON FUNCTION public.bloquear_truncate() FROM PUBLIC, anon, authenticated;

-- 3) El trigger específico de productos queda reemplazado por el genérico.
DROP TRIGGER IF EXISTS trg_productos_baja_logica ON public.productos;
DROP FUNCTION IF EXISTS public.productos_baja_logica();

-- 4) Aplicar a todas las tablas de public (menos auditorias, que va aparte)
DO $$
DECLARE
  t record;
  v_pk text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'auditorias'
    ORDER BY c.relname
  LOOP
    -- Columnas de la baja lógica
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS eliminado_en timestamptz', t.relname);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS eliminado_por uuid', t.relname);
    EXECUTE format($c$COMMENT ON COLUMN public.%I.eliminado_en IS 'Baja lógica: fecha en que se eliminó. NULL = activo. Los registros nunca se borran físicamente.'$c$, t.relname);

    -- Clave primaria -> argumentos del trigger
    SELECT string_agg(quote_literal(a.attname), ', ' ORDER BY array_position(i.indkey::int2[], a.attnum))
    INTO v_pk
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = t.oid AND i.indisprimary;

    IF v_pk IS NULL THEN
      RAISE EXCEPTION 'La tabla % no tiene clave primaria: no se puede aplicar la baja lógica.', t.relname;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS trg_baja_logica ON public.%I', t.relname);
    EXECUTE format('CREATE TRIGGER trg_baja_logica BEFORE DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.baja_logica(%s)', t.relname, v_pk);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_bloquear_truncate ON public.%I', t.relname);
    EXECUTE format('CREATE TRIGGER trg_bloquear_truncate BEFORE TRUNCATE ON public.%I
                    FOR EACH STATEMENT EXECUTE FUNCTION public.bloquear_truncate()', t.relname);

    -- Ocultar lo dado de baja (productos tiene su propia regla, más abajo)
    EXECUTE format('DROP POLICY IF EXISTS "Ocultar registros dados de baja" ON public.%I', t.relname);
    IF t.relname <> 'productos' THEN
      EXECUTE format('CREATE POLICY "Ocultar registros dados de baja" ON public.%I
                      AS RESTRICTIVE FOR SELECT TO anon, authenticated
                      USING (eliminado_en IS NULL)', t.relname);
    END IF;
  END LOOP;
END;
$$;

-- Productos eliminados: ocultos para el público, visibles para su dueño (restaurar) y administradores.
CREATE POLICY "Ocultar registros dados de baja" ON public.productos
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (
    eliminado_en IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tiendas AS tienda
      WHERE tienda.id = productos.tienda_id AND tienda.usuario_id = (SELECT auth.uid())
    )
    OR (SELECT public.es_administrador_actual())
  );

-- ---------------------------------------------------------------------
-- 5) Logs inalterables: auditorias solo admite INSERT
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auditoria_inalterable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('app.borrado_fisico', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  -- Única modificación automática permitida: al borrar una cuenta de acceso, la base
  -- pone usuario_id en NULL (ON DELETE SET NULL). El correo y el resto del log se conservan.
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
     AND NEW.usuario_id IS NULL AND OLD.usuario_id IS NOT NULL
     AND (to_jsonb(NEW) - 'usuario_id') = (to_jsonb(OLD) - 'usuario_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Los logs de auditoría no se pueden %: son un registro inalterable.',
    CASE TG_OP WHEN 'UPDATE' THEN 'modificar' WHEN 'DELETE' THEN 'borrar' ELSE 'vaciar' END
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
REVOKE ALL ON FUNCTION public.auditoria_inalterable() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_auditoria_inalterable ON public.auditorias;
CREATE TRIGGER trg_auditoria_inalterable
  BEFORE UPDATE OR DELETE ON public.auditorias
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_inalterable();

DROP TRIGGER IF EXISTS trg_auditoria_sin_truncate ON public.auditorias;
CREATE TRIGGER trg_auditoria_sin_truncate
  BEFORE TRUNCATE ON public.auditorias
  FOR EACH STATEMENT EXECUTE FUNCTION public.auditoria_inalterable();

-- La limpieza de logs antiguos ya no existe: los logs se conservan siempre.
DROP FUNCTION IF EXISTS public.auditoria_limpiar(integer);
