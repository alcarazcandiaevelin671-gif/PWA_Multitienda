CREATE OR REPLACE FUNCTION public.crear_pedido_checkout(
  p_tienda_id uuid,
  p_items jsonb,
  p_metodo_pago text,
  p_direccion_entrega text,
  p_distrito_id integer DEFAULT NULL,
  p_latitud numeric DEFAULT NULL,
  p_longitud numeric DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_pedido_id uuid := gen_random_uuid();
  v_numero_pedido text;
  v_item_count integer;
  v_matched_count integer;
  v_subtotal numeric(12, 0);
  v_descuento numeric(12, 0);
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesión autenticada.'
      USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios AS usuario WHERE usuario.id = v_usuario_id
  ) THEN
    RAISE EXCEPTION 'No existe un perfil de usuario asociado a la sesión.'
      USING ERRCODE = '23503';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'El pedido debe contener una lista de productos.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'El pedido debe contener entre 1 y 50 productos.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS item(producto_id uuid, cantidad integer)
    WHERE item.producto_id IS NULL
       OR item.cantidad IS NULL
       OR item.cantidad < 1
       OR item.cantidad > 99
  ) THEN
    RAISE EXCEPTION 'Producto o cantidad no válidos.'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*), count(DISTINCT item.producto_id)
  INTO v_item_count, v_matched_count
  FROM jsonb_to_recordset(p_items) AS item(producto_id uuid, cantidad integer);

  IF v_item_count <> v_matched_count THEN
    RAISE EXCEPTION 'El carrito contiene productos duplicados.'
      USING ERRCODE = '22023';
  END IF;

  IF p_metodo_pago NOT IN ('efectivo', 'transferencia') THEN
    RAISE EXCEPTION 'Método de pago no admitido.'
      USING ERRCODE = '22023';
  END IF;

  IF p_direccion_entrega IS NULL OR length(btrim(p_direccion_entrega)) < 3
     OR length(p_direccion_entrega) > 500 THEN
    RAISE EXCEPTION 'La dirección de entrega no es válida.'
      USING ERRCODE = '22023';
  END IF;

  IF p_notas IS NOT NULL AND length(p_notas) > 1000 THEN
    RAISE EXCEPTION 'Las notas superan el límite permitido.'
      USING ERRCODE = '22023';
  END IF;

  IF (p_latitud IS NULL) <> (p_longitud IS NULL)
     OR (p_latitud IS NOT NULL AND p_latitud NOT BETWEEN -90 AND 90)
     OR (p_longitud IS NOT NULL AND p_longitud NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'La ubicación no es válida.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tiendas AS tienda
    WHERE tienda.id = p_tienda_id
      AND tienda.estado::text = 'activa'
  ) THEN
    RAISE EXCEPTION 'La tienda seleccionada no existe o no está activa.'
      USING ERRCODE = '23503';
  END IF;

  IF p_distrito_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.distritos AS distrito WHERE distrito.id = p_distrito_id
  ) THEN
    RAISE EXCEPTION 'El distrito seleccionado no existe.'
      USING ERRCODE = '23503';
  END IF;

  SELECT
    count(*),
    COALESCE(sum(producto.precio_gs * item.cantidad), 0),
    COALESCE(sum(
      (producto.precio_gs - CASE
        WHEN producto.precio_oferta > 0
         AND producto.precio_oferta < producto.precio_gs
          THEN producto.precio_oferta
        ELSE producto.precio_gs
      END) * item.cantidad
    ), 0)
  INTO v_matched_count, v_subtotal, v_descuento
  FROM jsonb_to_recordset(p_items) AS item(producto_id uuid, cantidad integer)
  JOIN public.productos AS producto
    ON producto.id = item.producto_id
   AND producto.tienda_id = p_tienda_id
   AND producto.disponible = true;

  IF v_matched_count <> v_item_count THEN
    RAISE EXCEPTION 'Uno o más productos no existen, no están disponibles o pertenecen a otra tienda.'
      USING ERRCODE = '22023';
  END IF;

  v_numero_pedido := 'PG-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(replace(v_pedido_id::text, '-', ''));

  INSERT INTO public.pedidos (
    id, usuario_id, tienda_id, numero_pedido, estado, subtotal, descuento,
    envio, total, metodo_pago, estado_pago, direccion_entrega, distrito_id,
    latitud, longitud, notas, created_at, updated_at
  ) VALUES (
    v_pedido_id, v_usuario_id, p_tienda_id, v_numero_pedido, 'pendiente',
    v_subtotal, v_descuento, 0, v_subtotal - v_descuento, p_metodo_pago,
    'pendiente', btrim(p_direccion_entrega), p_distrito_id, p_latitud,
    p_longitud, NULLIF(btrim(p_notas), ''), clock_timestamp(), clock_timestamp()
  );

  INSERT INTO public.pedido_detalles (
    pedido_id, producto_id, cantidad, precio, descuento, subtotal,
    nombre_producto_snapshot, descripcion_snapshot, created_at
  )
  SELECT
    v_pedido_id,
    producto.id,
    item.cantidad,
    producto.precio_gs,
    (producto.precio_gs - CASE
      WHEN producto.precio_oferta > 0
       AND producto.precio_oferta < producto.precio_gs
        THEN producto.precio_oferta
      ELSE producto.precio_gs
    END) * item.cantidad,
    CASE
      WHEN producto.precio_oferta > 0
       AND producto.precio_oferta < producto.precio_gs
        THEN producto.precio_oferta
      ELSE producto.precio_gs
    END * item.cantidad,
    COALESCE(NULLIF(btrim(producto.nombre), ''), producto.titulo),
    producto.descripcion,
    clock_timestamp()
  FROM jsonb_to_recordset(p_items) AS item(producto_id uuid, cantidad integer)
  JOIN public.productos AS producto
    ON producto.id = item.producto_id
   AND producto.tienda_id = p_tienda_id
   AND producto.disponible = true;

  INSERT INTO public.pedido_estado_historial (
    pedido_id, estado_anterior, estado_nuevo, observacion, created_at
  ) VALUES (
    v_pedido_id, NULL, 'pendiente', 'Pedido creado desde checkout.', clock_timestamp()
  );

  RETURN v_pedido_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.obtener_pedidos_mis_tiendas()
RETURNS SETOF public.pedidos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT pedido.*
  FROM public.pedidos AS pedido
  JOIN public.tiendas AS tienda
    ON tienda.id = pedido.tienda_id
  WHERE tienda.usuario_id = auth.uid()
  ORDER BY pedido.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.obtener_pedidos_mis_tiendas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_pedidos_mis_tiendas() TO authenticated;

REVOKE ALL ON FUNCTION public.crear_pedido_checkout(
  uuid, jsonb, text, text, integer, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.procesar_checkout_pedido_venta_factura(
  p_tienda_id uuid,
  p_items jsonb,
  p_metodo_pago text,
  p_direccion_entrega text,
  p_distrito_id integer DEFAULT NULL,
  p_latitud numeric DEFAULT NULL,
  p_longitud numeric DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_pedido_id uuid;
  v_venta_id uuid := gen_random_uuid();
  v_factura_id uuid := gen_random_uuid();
  v_numero_venta text;
  v_numero_factura text;
  v_pedido record;
BEGIN
  v_pedido_id := public.crear_pedido_checkout(
    p_tienda_id => p_tienda_id,
    p_items => p_items,
    p_metodo_pago => p_metodo_pago,
    p_direccion_entrega => p_direccion_entrega,
    p_distrito_id => p_distrito_id,
    p_latitud => p_latitud,
    p_longitud => p_longitud,
    p_notas => p_notas
  );

  SELECT
    pedido.id,
    pedido.usuario_id,
    pedido.tienda_id,
    pedido.numero_pedido,
    pedido.estado,
    pedido.subtotal,
    pedido.descuento,
    pedido.total,
    pedido.metodo_pago
  INTO v_pedido
  FROM public.pedidos AS pedido
  WHERE pedido.id = v_pedido_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo recuperar el pedido recién creado.'
      USING ERRCODE = 'P0002';
  END IF;

  v_numero_venta := 'VG-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(replace(v_venta_id::text, '-', ''));
  v_numero_factura := 'INT-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(replace(v_factura_id::text, '-', ''));

  INSERT INTO public.ventas (
    id,
    pedido_id,
    tienda_id,
    cliente_id,
    numero_venta,
    subtotal,
    descuento,
    total,
    metodo_pago,
    estado,
    created_at,
    updated_at
  ) VALUES (
    v_venta_id,
    v_pedido.id,
    v_pedido.tienda_id,
    v_pedido.usuario_id,
    v_numero_venta,
    v_pedido.subtotal,
    v_pedido.descuento,
    v_pedido.total,
    v_pedido.metodo_pago,
    'pendiente',
    clock_timestamp(),
    clock_timestamp()
  );

  INSERT INTO public.venta_detalles (
    id,
    venta_id,
    producto_id,
    cantidad,
    precio,
    descuento,
    subtotal,
    nombre_producto_snapshot,
    descripcion_snapshot,
    created_at
  )
  SELECT
    gen_random_uuid(),
    v_venta_id,
    detalle.producto_id,
    detalle.cantidad,
    detalle.precio,
    detalle.descuento,
    detalle.subtotal,
    detalle.nombre_producto_snapshot,
    detalle.descripcion_snapshot,
    clock_timestamp()
  FROM public.pedido_detalles AS detalle
  WHERE detalle.pedido_id = v_pedido.id;

  INSERT INTO public.facturas (
    id,
    venta_id,
    pedido_id,
    tienda_id,
    cliente_id,
    tipo_documento,
    numero,
    estado,
    fecha,
    moneda,
    subtotal,
    descuento,
    total,
    iva,
    created_at,
    updated_at
  ) VALUES (
    v_factura_id,
    v_venta_id,
    v_pedido.id,
    v_pedido.tienda_id,
    v_pedido.usuario_id,
    'interna',
    v_numero_factura,
    'borrador',
    clock_timestamp(),
    'PYG',
    v_pedido.subtotal,
    v_pedido.descuento,
    v_pedido.total,
    0,
    clock_timestamp(),
    clock_timestamp()
  );

  INSERT INTO public.factura_detalles (
    id,
    factura_id,
    producto_id,
    cantidad,
    precio,
    descuento,
    subtotal,
    descripcion_snapshot,
    created_at
  )
  SELECT
    gen_random_uuid(),
    v_factura_id,
    detalle.producto_id,
    detalle.cantidad,
    detalle.precio,
    detalle.descuento,
    detalle.subtotal,
    concat_ws(E'\n', detalle.nombre_producto_snapshot, detalle.descripcion_snapshot),
    clock_timestamp()
  FROM public.pedido_detalles AS detalle
  WHERE detalle.pedido_id = v_pedido.id;

  RETURN jsonb_build_object(
    'pedido_id', v_pedido.id,
    'numero_pedido', v_pedido.numero_pedido,
    'venta_id', v_venta_id,
    'factura_id', v_factura_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.procesar_checkout_pedido_venta_factura(
  uuid, jsonb, text, text, integer, numeric, numeric, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.procesar_checkout_pedido_venta_factura(
  uuid, jsonb, text, text, integer, numeric, numeric, text
) TO authenticated;