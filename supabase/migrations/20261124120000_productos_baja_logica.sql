-- =====================================================================
-- Productos: BAJA LÓGICA (nunca se borran de la base de datos)
--
-- Problema: al eliminar un producto que ya tenía pedidos/ventas, la base lo
-- impedía (pedido_detalles y venta_detalles lo referencian con ON DELETE
-- RESTRICT) y el vendedor veía un error genérico.
--
-- Solución: un DELETE sobre `productos` se convierte en una baja lógica:
--   - se marca `eliminado_en` (cuándo) y `eliminado_por` (quién);
--   - el producto queda oculto (`disponible = false`) y no vuelve a mostrarse
--     aunque se reponga stock;
--   - sus pedidos, ventas, facturas y tickets siguen intactos;
--   - el vendedor puede restaurarlo (eliminado_en = NULL).
-- En los logs aparece como operación DELETE con acción "BAJA LÓGICA".
--
-- Excepción: si se borra la TIENDA completa (cascada) o un administrador
-- activa a propósito `SET LOCAL app.borrado_fisico = 'on'`, el borrado es real.
-- =====================================================================

-- 1) Columnas de la baja lógica
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS eliminado_en timestamptz,
  ADD COLUMN IF NOT EXISTS eliminado_por uuid;
COMMENT ON COLUMN public.productos.eliminado_en IS 'Fecha de la baja lógica. NULL = producto activo. Los productos nunca se borran físicamente.';
COMMENT ON COLUMN public.productos.eliminado_por IS 'Usuario que dio de baja el producto.';
CREATE INDEX IF NOT EXISTS idx_productos_tienda_activos ON public.productos (tienda_id) WHERE eliminado_en IS NULL;

-- 2) DELETE -> baja lógica
CREATE OR REPLACE FUNCTION public.productos_baja_logica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Borrado en cascada de la tienda (profundidad > 1) o borrado físico pedido a propósito.
  IF pg_trigger_depth() > 1 OR coalesce(current_setting('app.borrado_fisico', true), '') = 'on' THEN
    RETURN OLD;
  END IF;

  -- Se ejecuta con los permisos de quien borra: RLS sigue aplicando (solo el dueño).
  UPDATE public.productos
  SET eliminado_en = now(),
      eliminado_por = auth.uid(),
      disponible = false
  WHERE id = OLD.id AND eliminado_en IS NULL;

  RETURN NULL; -- cancela el borrado real
END;
$$;

DROP TRIGGER IF EXISTS trg_productos_baja_logica ON public.productos;
CREATE TRIGGER trg_productos_baja_logica
  BEFORE DELETE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.productos_baja_logica();

-- 3) Visibilidad: un producto eliminado nunca se muestra; al restaurarlo vuelve
--    visible si tiene stock (o no controla stock).
CREATE OR REPLACE FUNCTION public.productos_gestionar_visibilidad_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.eliminado_en IS NOT NULL THEN
    NEW.disponible := false;
    NEW.oculto_por_stock := false;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.eliminado_en IS NOT NULL THEN
    -- Restauración
    NEW.eliminado_por := NULL;
    NEW.disponible := coalesce(NEW.stock, 1) > 0;
    NEW.oculto_por_stock := coalesce(NEW.stock = 0, false); -- stock NULL (sin control) => false
    RETURN NEW;
  END IF;

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
  BEFORE INSERT OR UPDATE OF stock, disponible, eliminado_en ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.productos_gestionar_visibilidad_stock();

-- 4) Avisos de stock: no avisar por productos eliminados.
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
  IF NEW.eliminado_en IS NOT NULL OR OLD.eliminado_en IS NOT NULL THEN
    RETURN NEW;
  END IF;
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
REVOKE ALL ON FUNCTION public.productos_avisar_stock() FROM PUBLIC, anon, authenticated;

-- 5) Auditoría: la baja lógica se registra como DELETE ("BAJA LÓGICA") y la
--    restauración como UPDATE ("RESTAURACIÓN"), en cualquier tabla con `eliminado_en`.
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
  v_operacion text := TG_OP;
  v_accion text := TG_OP;
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

    IF v_despues ? 'eliminado_en' THEN
      IF (v_antes ->> 'eliminado_en') IS NULL AND (v_despues ->> 'eliminado_en') IS NOT NULL THEN
        v_operacion := 'DELETE';
        v_accion := 'BAJA LÓGICA';
      ELSIF (v_antes ->> 'eliminado_en') IS NOT NULL AND (v_despues ->> 'eliminado_en') IS NULL THEN
        v_accion := 'RESTAURACIÓN';
      END IF;
    END IF;
  END IF;

  v_registro := coalesce(v_despues ->> 'id', v_antes ->> 'id', v_despues ->> 'usuario_id', v_antes ->> 'usuario_id');
  v_ctx := public.auditoria_contexto();

  INSERT INTO public.auditorias (
    usuario_id, accion, operacion, esquema, tabla_afectada, registro_id,
    datos_anteriores, datos_nuevos, campos_modificados,
    usuario_email, usuario_rol, rol_bd, origen, ip, ip_cliente, user_agent, metodo_http, ruta, fecha_hora
  ) VALUES (
    NULLIF(v_ctx ->> 'usuario_id', '')::uuid, v_accion, v_operacion, TG_TABLE_SCHEMA, TG_TABLE_NAME, v_registro,
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
REVOKE ALL ON FUNCTION public.auditoria_registrar_cambio() FROM PUBLIC, anon, authenticated;
