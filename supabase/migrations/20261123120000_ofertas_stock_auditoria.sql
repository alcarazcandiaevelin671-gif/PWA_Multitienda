-- =====================================================================
-- Ofertas, stock con avisos al vendedor y auditoría completa
--
-- 1) OFERTAS: precio_oferta válido (mayor a 0 y menor que el precio normal).
-- 2) STOCK:   stock NULL = sin control (comportamiento anterior).
--             stock_minimo = umbral de "quedan pocas unidades".
--             Al llegar a 0 el producto se oculta solo (oculto_por_stock);
--             al reponer stock vuelve a mostrarse. Cada cambio se avisa al vendedor.
--             El checkout descuenta stock (y falla si no alcanza); cancelar un
--             pedido lo repone.
-- 3) AUDITORÍA: trigger en todas las tablas de la app (INSERT, UPDATE, DELETE,
--             TRUNCATE) + trigger de eventos para DDL (CREATE, ALTER, DROP…).
--             Registra quién, rol, correo, IP, navegador, vía, ruta, columnas
--             cambiadas, antes y después.
-- Idempotente. Ejecutar completo (se aplica en una transacción).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) OFERTAS
-- ---------------------------------------------------------------------
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_precio_oferta_check;
ALTER TABLE public.productos ADD CONSTRAINT productos_precio_oferta_check
  CHECK (precio_oferta IS NULL OR (precio_oferta > 0 AND precio_oferta < precio_gs)) NOT VALID;
ALTER TABLE public.productos VALIDATE CONSTRAINT productos_precio_oferta_check;
COMMENT ON COLUMN public.productos.precio_oferta IS
  'Precio de oferta activo (NULL = sin oferta). Debe ser > 0 y menor que precio_gs.';

-- ---------------------------------------------------------------------
-- 2) STOCK
-- ---------------------------------------------------------------------
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS stock_minimo integer NOT NULL DEFAULT 5;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS oculto_por_stock boolean NOT NULL DEFAULT false;
ALTER TABLE public.productos DROP CONSTRAINT IF EXISTS productos_stock_minimo_check;
ALTER TABLE public.productos ADD CONSTRAINT productos_stock_minimo_check CHECK (stock_minimo >= 0);
COMMENT ON COLUMN public.productos.stock IS 'Unidades disponibles. NULL = sin control de stock.';
COMMENT ON COLUMN public.productos.stock_minimo IS 'Con stock en o por debajo de este número se avisa al vendedor.';
COMMENT ON COLUMN public.productos.oculto_por_stock IS 'true si el sistema ocultó el producto por quedarse sin stock.';

-- 2a) Ocultar al agotarse / volver a mostrar al reponer (antes de guardar la fila).
CREATE OR REPLACE FUNCTION public.productos_gestionar_visibilidad_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.stock IS NULL THEN
    -- Sin control de stock: el sistema no oculta nada.
    IF NEW.oculto_por_stock THEN
      NEW.oculto_por_stock := false;
      NEW.disponible := true;
    END IF;
  ELSIF NEW.stock = 0 THEN
    IF NEW.disponible THEN
      NEW.disponible := false;
      NEW.oculto_por_stock := true;
    END IF;
  ELSIF NEW.oculto_por_stock THEN
    -- Repusieron stock de un producto que había ocultado el sistema: vuelve a mostrarse.
    NEW.disponible := true;
    NEW.oculto_por_stock := false;
  END IF;

  -- Si el vendedor lo oculta a mano con stock disponible, no es un ocultamiento automático.
  IF TG_OP = 'UPDATE' AND NEW.disponible = false AND OLD.disponible = true
     AND coalesce(NEW.stock, 1) > 0 THEN
    NEW.oculto_por_stock := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_visibilidad_stock ON public.productos;
CREATE TRIGGER trg_productos_visibilidad_stock
  BEFORE INSERT OR UPDATE OF stock, disponible ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.productos_gestionar_visibilidad_stock();

-- 2b) Avisos al vendedor (después de guardar).
CREATE OR REPLACE FUNCTION public.productos_avisar_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vendedor uuid;
  v_nombre text := coalesce(nullif(btrim(NEW.nombre), ''), NEW.titulo);
  v_titulo text;
  v_mensaje text;
  v_tipo text;
BEGIN
  IF NEW.stock IS NOT DISTINCT FROM OLD.stock AND NEW.disponible IS NOT DISTINCT FROM OLD.disponible THEN
    RETURN NEW;
  END IF;

  IF NEW.stock = 0 AND coalesce(OLD.stock, -1) <> 0 THEN
    v_tipo := 'stock_agotado';
    v_titulo := 'Producto agotado';
    v_mensaje := format('"%s" se quedó sin stock y se ocultó del catálogo. Repón stock para que vuelva a mostrarse.', v_nombre);
  ELSIF OLD.oculto_por_stock AND NOT NEW.oculto_por_stock AND NEW.disponible AND coalesce(NEW.stock, 1) > 0 THEN
    v_tipo := 'stock_repuesto';
    v_titulo := 'Producto visible otra vez';
    v_mensaje := format('Repusiste stock de "%s" (%s unidades): ya se muestra de nuevo en el catálogo.', v_nombre, coalesce(NEW.stock::text, 'sin control'));
  ELSIF NEW.stock IS NOT NULL AND NEW.stock > 0 AND NEW.stock <= NEW.stock_minimo
        AND (OLD.stock IS NULL OR OLD.stock > NEW.stock_minimo OR OLD.stock = 0) THEN
    v_tipo := 'stock_bajo';
    v_titulo := 'Quedan pocas unidades';
    v_mensaje := format('A "%s" le quedan %s unidades (aviso a partir de %s). Considera reponer stock.', v_nombre, NEW.stock, NEW.stock_minimo);
  ELSE
    RETURN NEW;
  END IF;

  SELECT tienda.usuario_id INTO v_vendedor FROM public.tiendas AS tienda WHERE tienda.id = NEW.tienda_id;
  IF v_vendedor IS NOT NULL THEN
    INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, link, leida)
    VALUES (v_vendedor, v_titulo, v_mensaje, v_tipo, '/vendedor/productos', false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_avisar_stock ON public.productos;
CREATE TRIGGER trg_productos_avisar_stock
  AFTER UPDATE OF stock, disponible ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.productos_avisar_stock();

-- 2c) Checkout: cada línea del pedido descuenta stock (o cancela todo si no alcanza).
CREATE OR REPLACE FUNCTION public.pedido_detalle_descontar_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_producto record;
BEGIN
  IF NEW.producto_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, stock, coalesce(nullif(btrim(nombre), ''), titulo) AS nombre
    INTO v_producto
  FROM public.productos
  WHERE id = NEW.producto_id
  FOR UPDATE;  -- evita que dos compras simultáneas vendan la misma última unidad

  IF FOUND AND v_producto.stock IS NOT NULL THEN
    IF v_producto.stock < NEW.cantidad THEN
      RAISE EXCEPTION 'No hay stock suficiente de "%": quedan % unidades.', v_producto.nombre, v_producto.stock
        USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_detalle_descontar_stock ON public.pedido_detalles;
CREATE TRIGGER trg_pedido_detalle_descontar_stock
  BEFORE INSERT ON public.pedido_detalles
  FOR EACH ROW EXECUTE FUNCTION public.pedido_detalle_descontar_stock();

-- 2d) Pedido cancelado: devolver las unidades al stock.
CREATE OR REPLACE FUNCTION public.pedido_cancelado_reponer_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.estado = 'cancelado' AND OLD.estado IS DISTINCT FROM 'cancelado' THEN
    UPDATE public.productos AS producto
       SET stock = producto.stock + detalle.cantidad
      FROM public.pedido_detalles AS detalle
     WHERE detalle.pedido_id = NEW.id
       AND detalle.producto_id = producto.id
       AND producto.stock IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_cancelado_reponer_stock ON public.pedidos;
CREATE TRIGGER trg_pedido_cancelado_reponer_stock
  AFTER UPDATE OF estado ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.pedido_cancelado_reponer_stock();

REVOKE ALL ON FUNCTION public.productos_avisar_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pedido_detalle_descontar_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pedido_cancelado_reponer_stock() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) AUDITORÍA
-- ---------------------------------------------------------------------
ALTER TABLE public.auditorias
  ADD COLUMN IF NOT EXISTS operacion text,           -- INSERT | UPDATE | DELETE | TRUNCATE | DDL | APP
  ADD COLUMN IF NOT EXISTS esquema text,
  ADD COLUMN IF NOT EXISTS campos_modificados text[],
  ADD COLUMN IF NOT EXISTS usuario_email text,
  ADD COLUMN IF NOT EXISTS usuario_rol text,          -- rol en la app: cliente | comerciante | admin
  ADD COLUMN IF NOT EXISTS rol_bd text,               -- anon | authenticated | service_role | postgres…
  ADD COLUMN IF NOT EXISTS origen text,               -- app (navegador/API) | servidor (clave secreta) | sql (editor/migración)
  ADD COLUMN IF NOT EXISTS ip text,                   -- IP vista por Supabase (Cloudflare / x-forwarded-for)
  ADD COLUMN IF NOT EXISTS ip_cliente text,           -- IP del navegador informada por el servidor de la app (x-client-ip)
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS metodo_http text,
  ADD COLUMN IF NOT EXISTS ruta text,
  ADD COLUMN IF NOT EXISTS objeto text,               -- DDL: objeto afectado (p. ej. public.productos)
  ADD COLUMN IF NOT EXISTS comando_sql text;          -- DDL: sentencia ejecutada (recortada)

ALTER TABLE public.auditorias ALTER COLUMN fecha_hora SET DEFAULT now();

-- Registros anteriores: completar la operación a partir de la acción guardada.
UPDATE public.auditorias
   SET operacion = CASE WHEN upper(accion) IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') THEN upper(accion) ELSE 'APP' END,
       esquema = coalesce(esquema, 'public')
 WHERE operacion IS NULL;

CREATE INDEX IF NOT EXISTS auditorias_operacion_fecha_idx ON public.auditorias (operacion, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS auditorias_tabla_fecha_idx ON public.auditorias (tabla_afectada, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS auditorias_ip_idx ON public.auditorias (ip);

-- Datos del contexto de la petición (quién, desde dónde, por qué vía).
CREATE OR REPLACE FUNCTION public.auditoria_contexto()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  v_headers jsonb := NULLIF(current_setting('request.headers', true), '')::jsonb;
  v_uid uuid := NULLIF(v_claims ->> 'sub', '')::uuid;
  v_rol_app text;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT lower(u.rol::text) INTO v_rol_app FROM public.usuarios AS u WHERE u.id = v_uid;
  END IF;
  RETURN jsonb_build_object(
    'usuario_id', v_uid,
    'usuario_email', v_claims ->> 'email',
    'usuario_rol', v_rol_app,
    'rol_bd', coalesce(v_claims ->> 'role', current_user),
    'origen', CASE
                WHEN v_claims IS NULL THEN 'sql'
                WHEN v_claims ->> 'role' = 'service_role' THEN 'servidor'
                ELSE 'app'
              END,
    'ip', coalesce(v_headers ->> 'cf-connecting-ip',
                   btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)),
                   v_headers ->> 'x-real-ip',
                   CASE WHEN v_claims IS NULL THEN host(inet_client_addr()) END),
    'ip_cliente', v_headers ->> 'x-client-ip',
    'user_agent', left(coalesce(v_headers ->> 'x-client-user-agent', v_headers ->> 'user-agent'), 400),
    'metodo_http', NULLIF(current_setting('request.method', true), ''),
    'ruta', NULLIF(current_setting('request.path', true), '')
  );
END;
$$;

-- Trigger genérico por fila: INSERT / UPDATE / DELETE.
CREATE OR REPLACE FUNCTION public.auditoria_registrar_cambio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ctx jsonb;
  v_antes jsonb;
  v_despues jsonb;
  v_campos text[];
  v_registro text;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_antes := to_jsonb(OLD); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_despues := to_jsonb(NEW); END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(clave ORDER BY clave) INTO v_campos
    FROM jsonb_object_keys(v_despues) AS clave
    WHERE v_despues -> clave IS DISTINCT FROM v_antes -> clave
      AND clave NOT IN ('actualizado_en', 'updated_at');
    -- Solo se tocó la fecha de actualización: no es un cambio real.
    IF v_campos IS NULL THEN RETURN NULL; END IF;
  END IF;

  v_registro := coalesce(v_despues ->> 'id', v_antes ->> 'id', v_despues ->> 'usuario_id', v_antes ->> 'usuario_id');
  v_ctx := public.auditoria_contexto();

  INSERT INTO public.auditorias (
    usuario_id, accion, operacion, esquema, tabla_afectada, registro_id,
    datos_anteriores, datos_nuevos, campos_modificados,
    usuario_email, usuario_rol, rol_bd, origen, ip, ip_cliente, user_agent, metodo_http, ruta, fecha_hora
  ) VALUES (
    NULLIF(v_ctx ->> 'usuario_id', '')::uuid, TG_OP, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME, v_registro,
    v_antes, v_despues, v_campos,
    v_ctx ->> 'usuario_email', v_ctx ->> 'usuario_rol', v_ctx ->> 'rol_bd', v_ctx ->> 'origen',
    v_ctx ->> 'ip', v_ctx ->> 'ip_cliente', v_ctx ->> 'user_agent', v_ctx ->> 'metodo_http', v_ctx ->> 'ruta', clock_timestamp()
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- La auditoría nunca debe impedir la operación del usuario.
  RAISE WARNING 'Auditoría no registrada en %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END;
$$;

-- Trigger por sentencia: TRUNCATE (vaciar una tabla).
CREATE OR REPLACE FUNCTION public.auditoria_registrar_truncate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ctx jsonb := public.auditoria_contexto();
BEGIN
  INSERT INTO public.auditorias (
    usuario_id, accion, operacion, esquema, tabla_afectada, usuario_email, usuario_rol, rol_bd, origen,
    ip, ip_cliente, user_agent, metodo_http, ruta, comando_sql, fecha_hora
  ) VALUES (
    NULLIF(v_ctx ->> 'usuario_id', '')::uuid, 'TRUNCATE', 'TRUNCATE', TG_TABLE_SCHEMA, TG_TABLE_NAME,
    v_ctx ->> 'usuario_email', v_ctx ->> 'usuario_rol', v_ctx ->> 'rol_bd', v_ctx ->> 'origen',
    v_ctx ->> 'ip', v_ctx ->> 'ip_cliente', v_ctx ->> 'user_agent', v_ctx ->> 'metodo_http', v_ctx ->> 'ruta',
    left(current_query(), 4000), clock_timestamp()
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auditoría de TRUNCATE no registrada: %', SQLERRM;
  RETURN NULL;
END;
$$;

-- Reemplaza los triggers de auditoría anteriores (solo cubrían 3 tablas) por el genérico en TODAS.
DROP TRIGGER IF EXISTS audit_productos ON public.productos;
DROP TRIGGER IF EXISTS audit_tiendas ON public.tiendas;
DROP TRIGGER IF EXISTS audit_usuarios ON public.usuarios;
DROP TRIGGER IF EXISTS trg_auditar_cambio_usuario ON public.usuarios;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'auditorias'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_auditoria_fila ON public.%I', t.relname);
    EXECUTE format('CREATE TRIGGER zz_auditoria_fila AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.auditoria_registrar_cambio()', t.relname);
    EXECUTE format('DROP TRIGGER IF EXISTS zz_auditoria_truncate ON public.%I', t.relname);
    EXECUTE format('CREATE TRIGGER zz_auditoria_truncate AFTER TRUNCATE ON public.%I
                    FOR EACH STATEMENT EXECUTE FUNCTION public.auditoria_registrar_truncate()', t.relname);
  END LOOP;
END
$$;

-- Trigger de eventos: cambios de estructura (CREATE / ALTER / DROP …) en el esquema public.
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
      VALUES ('DROP ' || upper(r.object_type), 'DDL', r.schema_name, r.object_name, r.object_identity,
              left(current_query(), 4000), NULLIF(v_ctx ->> 'usuario_id', '')::uuid, v_ctx ->> 'usuario_email',
              v_ctx ->> 'usuario_rol', v_ctx ->> 'rol_bd', v_ctx ->> 'origen', v_ctx ->> 'ip', clock_timestamp());
    END LOOP;
  ELSE
    FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE schema_name = 'public' LOOP
      INSERT INTO public.auditorias (accion, operacion, esquema, tabla_afectada, objeto, comando_sql,
                                     usuario_id, usuario_email, usuario_rol, rol_bd, origen, ip, fecha_hora)
      VALUES (r.command_tag, 'DDL', r.schema_name, split_part(r.object_identity, '.', 2), r.object_identity,
              left(current_query(), 4000), NULLIF(v_ctx ->> 'usuario_id', '')::uuid, v_ctx ->> 'usuario_email',
              v_ctx ->> 'usuario_rol', v_ctx ->> 'rol_bd', v_ctx ->> 'origen', v_ctx ->> 'ip', clock_timestamp());
    END LOOP;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear un cambio de estructura (ni las migraciones de Supabase) por la auditoría.
  RAISE WARNING 'Auditoría DDL no registrada: %', SQLERRM;
END;
$$;

DROP EVENT TRIGGER IF EXISTS auditoria_ddl_fin;
CREATE EVENT TRIGGER auditoria_ddl_fin ON ddl_command_end EXECUTE FUNCTION public.auditoria_registrar_ddl();
DROP EVENT TRIGGER IF EXISTS auditoria_ddl_borrado;
CREATE EVENT TRIGGER auditoria_ddl_borrado ON sql_drop EXECUTE FUNCTION public.auditoria_registrar_ddl();

REVOKE ALL ON FUNCTION public.auditoria_contexto() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auditoria_registrar_cambio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auditoria_registrar_truncate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auditoria_registrar_ddl() FROM PUBLIC, anon, authenticated;

-- Limpieza opcional de registros antiguos (no se ejecuta sola): SELECT public.auditoria_limpiar(365);
CREATE OR REPLACE FUNCTION public.auditoria_limpiar(p_dias integer DEFAULT 365)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH borrados AS (
    DELETE FROM public.auditorias WHERE fecha_hora < now() - make_interval(days => greatest(p_dias, 30)) RETURNING 1
  )
  SELECT count(*)::integer FROM borrados;
$$;
REVOKE ALL ON FUNCTION public.auditoria_limpiar(integer) FROM PUBLIC, anon, authenticated;
