-- Seguridad y flujo de pedidos para cliente y vendedor.
-- Esta migración no reemplaza la estructura existente ni desactiva RLS.
-- Debe aplicarse en Supabase antes de usar la actualización de estados desde frontend.

CREATE POLICY pedidos_select_store_owner
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tiendas AS tienda
      WHERE tienda.id = pedidos.tienda_id
        AND tienda.usuario_id = auth.uid()
    )
  );

CREATE POLICY pedido_detalles_select_store_owner
  ON public.pedido_detalles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pedidos AS pedido
      JOIN public.tiendas AS tienda
        ON tienda.id = pedido.tienda_id
      WHERE pedido.id = pedido_detalles.pedido_id
        AND tienda.usuario_id = auth.uid()
    )
  );

CREATE POLICY pedido_estado_historial_select_store_owner
  ON public.pedido_estado_historial
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pedidos AS pedido
      JOIN public.tiendas AS tienda
        ON tienda.id = pedido.tienda_id
      WHERE pedido.id = pedido_estado_historial.pedido_id
        AND tienda.usuario_id = auth.uid()
    )
  );

CREATE FUNCTION public.actualizar_estado_pedido(
  p_pedido_id uuid,
  p_nuevo_estado text,
  p_observacion text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_pedido record;
  v_estado_anterior text;
  v_estado_nuevo text := lower(trim(p_nuevo_estado));
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesión autenticada.'
      USING ERRCODE = '28000';
  END IF;

  IF v_estado_nuevo NOT IN (
    'pendiente',
    'confirmado',
    'en_preparacion',
    'listo',
    'completado',
    'cancelado'
  ) THEN
    RAISE EXCEPTION 'El estado del pedido no es válido.'
      USING ERRCODE = '22023';
  END IF;

  SELECT pedido.id, pedido.estado, pedido.tienda_id
    INTO v_pedido
  FROM public.pedidos AS pedido
  JOIN public.tiendas AS tienda
    ON tienda.id = pedido.tienda_id
  WHERE pedido.id = p_pedido_id
    AND tienda.usuario_id = v_usuario_id
  FOR UPDATE OF pedido;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe o no pertenece a tu tienda.'
      USING ERRCODE = '42501';
  END IF;

  v_estado_anterior := v_pedido.estado;

  IF v_estado_anterior = 'pendiente' AND v_estado_nuevo NOT IN ('confirmado', 'cancelado') THEN
    RAISE EXCEPTION 'El pedido pendiente solo puede confirmarse o cancelarse.'
      USING ERRCODE = '22023';
  ELSIF v_estado_anterior = 'confirmado' AND v_estado_nuevo NOT IN ('en_preparacion', 'cancelado') THEN
    RAISE EXCEPTION 'El pedido confirmado solo puede pasar a preparación o cancelarse.'
      USING ERRCODE = '22023';
  ELSIF v_estado_anterior = 'en_preparacion' AND v_estado_nuevo NOT IN ('listo', 'cancelado') THEN
    RAISE EXCEPTION 'El pedido en preparación solo puede marcarse como listo o cancelarse.'
      USING ERRCODE = '22023';
  ELSIF v_estado_anterior = 'listo' AND v_estado_nuevo <> 'completado' THEN
    RAISE EXCEPTION 'El pedido listo solo puede completarse.'
      USING ERRCODE = '22023';
  ELSIF v_estado_anterior IN ('completado', 'cancelado') THEN
    RAISE EXCEPTION 'El pedido ya está en un estado final y no puede modificarse.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.pedidos
     SET estado = v_estado_nuevo,
         updated_at = clock_timestamp()
   WHERE id = p_pedido_id;

  INSERT INTO public.pedido_estado_historial (
    pedido_id,
    estado_anterior,
    estado_nuevo,
    observacion,
    created_at
  ) VALUES (
    p_pedido_id,
    v_estado_anterior,
    v_estado_nuevo,
    NULLIF(btrim(COALESCE(p_observacion, 'Estado actualizado por el vendedor.')), ''),
    clock_timestamp()
  );

  RETURN jsonb_build_object(
    'pedido_id', p_pedido_id,
    'estado_anterior', v_estado_anterior,
    'estado_nuevo', v_estado_nuevo
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_estado_pedido(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_estado_pedido(uuid, text, text) TO authenticated;
