-- =====================================================================
-- Corrige referencias a la columna inexistente "id_vendedor".
-- El dueño de una tienda es tiendas.usuario_id y su nombre es
-- tiendas.nombre_comercio. Un trigger que usaba NEW.id_vendedor hacía
-- fallar el checkout con: record "new" has no field "id_vendedor".
-- Ejecutar completo en Supabase > SQL Editor. Es idempotente.
-- =====================================================================

-- 1) Notificación de aprobación/rechazo de comercios (tabla tiendas).
CREATE OR REPLACE FUNCTION public.fn_notificar_vendedor_estado_tienda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.usuario_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF OLD.estado = 'pendiente' AND NEW.estado = 'activa' THEN
        INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, link, leida)
        VALUES (
            NEW.usuario_id,
            '¡Comercio Aprobado!',
            CONCAT('Tu comercio "', NEW.nombre_comercio, '" ha sido aprobado exitosamente y ya está visible.'),
            'comercio_aprobado',
            '/vendedor/tienda',
            FALSE
        );
    ELSIF OLD.estado = 'pendiente' AND NEW.estado = 'rechazada' THEN
        INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, link, leida)
        VALUES (
            NEW.usuario_id,
            'Solicitud Rechazada',
            CONCAT('La solicitud para tu comercio "', NEW.nombre_comercio, '" ha sido rechazada.'),
            'comercio_rechazado',
            '/vendedor/tienda',
            FALSE
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- 2) Cualquier otra función de trigger que use NEW/OLD.id_vendedor
--    (por ejemplo, la notificación de "nuevo pedido" creada desde el panel).
--    - En la tabla tiendas:            NEW.id_vendedor -> NEW.usuario_id
--    - En tablas con columna tienda_id: NEW.id_vendedor -> dueño de esa tienda
DO $fix$
DECLARE
  fn record;
  v_def text;
  v_new_def text;
  v_tables text[];
  v_has_tienda_id boolean;
BEGIN
  FOR fn IN
    SELECT DISTINCT p.oid, p.oid::regprocedure::text AS firma
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
      AND pg_get_functiondef(p.oid) ILIKE '%id_vendedor%'
  LOOP
    SELECT array_agg(DISTINCT c.relname::text)
      INTO v_tables
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgfoid = fn.oid AND NOT t.tgisinternal;

    v_def := pg_get_functiondef(fn.oid);

    IF v_tables = ARRAY['tiendas'] THEN
      v_new_def := regexp_replace(v_def, '\m(NEW|OLD)\.id_vendedor\M', '\1.usuario_id', 'gi');
    ELSE
      SELECT bool_and(EXISTS (
               SELECT 1 FROM information_schema.columns col
               WHERE col.table_schema = 'public'
                 AND col.table_name = tbl
                 AND col.column_name = 'tienda_id'))
        INTO v_has_tienda_id
      FROM unnest(v_tables) AS tbl;

      IF NOT v_has_tienda_id THEN
        RAISE NOTICE 'OMITIDA % (tablas %): no tienen tienda_id, revisar a mano.', fn.firma, v_tables;
        CONTINUE;
      END IF;

      v_new_def := regexp_replace(
        v_def,
        '\m(NEW|OLD)\.id_vendedor\M',
        '(SELECT tienda_dueno.usuario_id FROM public.tiendas AS tienda_dueno WHERE tienda_dueno.id = \1.tienda_id)',
        'gi'
      );
    END IF;

    IF v_new_def ILIKE '%id_vendedor%' THEN
      RAISE NOTICE 'OMITIDA % (tablas %): usa id_vendedor fuera de NEW/OLD, revisar a mano.', fn.firma, v_tables;
      CONTINUE;
    END IF;

    EXECUTE v_new_def;
    RAISE NOTICE 'CORREGIDA % (tablas %).', fn.firma, v_tables;
  END LOOP;
END
$fix$;

-- 3) Verificación: debe devolver 0 filas.
SELECT c.relname AS tabla, t.tgname AS trigger_name, p.proname AS funcion
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND pg_get_functiondef(p.oid) ILIKE '%id_vendedor%';
