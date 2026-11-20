CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tienda_id uuid NOT NULL REFERENCES public.tiendas(id) ON DELETE RESTRICT,
  numero_pedido text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'pendiente',
  subtotal numeric(12, 0) NOT NULL CHECK (subtotal >= 0),
  descuento numeric(12, 0) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  envio numeric(12, 0) NOT NULL DEFAULT 0 CHECK (envio >= 0),
  total numeric(12, 0) NOT NULL CHECK (total >= 0),
  metodo_pago text NOT NULL,
  estado_pago text NOT NULL DEFAULT 'pendiente',
  direccion_entrega text NOT NULL,
  distrito_id integer REFERENCES public.distritos(id) ON DELETE SET NULL,
  latitud numeric(10, 8),
  longitud numeric(11, 8),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_ubicacion_completa_check
    CHECK ((latitud IS NULL) = (longitud IS NULL)),
  CONSTRAINT pedidos_latitud_check
    CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
  CONSTRAINT pedidos_longitud_check
    CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180)
);

CREATE INDEX pedidos_usuario_created_idx
  ON public.pedidos (usuario_id, created_at DESC);
CREATE INDEX pedidos_tienda_created_idx
  ON public.pedidos (tienda_id, created_at DESC);

CREATE TABLE public.pedido_detalles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio numeric(12, 0) NOT NULL CHECK (precio >= 0),
  descuento numeric(12, 0) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  subtotal numeric(12, 0) NOT NULL CHECK (subtotal >= 0),
  nombre_producto_snapshot text NOT NULL,
  descripcion_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pedido_detalles_pedido_idx
  ON public.pedido_detalles (pedido_id);

CREATE TABLE public.pedido_estado_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  estado_anterior text,
  estado_nuevo text NOT NULL,
  observacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pedido_estado_historial_pedido_created_idx
  ON public.pedido_estado_historial (pedido_id, created_at);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_estado_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY pedidos_select_own
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (usuario_id = (SELECT auth.uid()));

CREATE POLICY pedido_detalles_select_own
  ON public.pedido_detalles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pedidos AS pedido
      WHERE pedido.id = pedido_detalles.pedido_id
        AND pedido.usuario_id = (SELECT auth.uid())
    )
  );

CREATE POLICY pedido_estado_historial_select_own
  ON public.pedido_estado_historial
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pedidos AS pedido
      WHERE pedido.id = pedido_estado_historial.pedido_id
        AND pedido.usuario_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.pedidos, public.pedido_detalles, public.pedido_estado_historial
  TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pedidos, public.pedido_detalles, public.pedido_estado_historial
  FROM anon, authenticated;

CREATE FUNCTION public.crear_pedido_checkout(
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
    id,
    usuario_id,
    tienda_id,
    numero_pedido,
    estado,
    subtotal,
    descuento,
    envio,
    total,
    metodo_pago,
    estado_pago,
    direccion_entrega,
    distrito_id,
    latitud,
    longitud,
    notas
  ) VALUES (
    v_pedido_id,
    v_usuario_id,
    p_tienda_id,
    v_numero_pedido,
    'pendiente',
    v_subtotal,
    v_descuento,
    0,
    v_subtotal - v_descuento,
    p_metodo_pago,
    'pendiente',
    btrim(p_direccion_entrega),
    p_distrito_id,
    p_latitud,
    p_longitud,
    NULLIF(btrim(p_notas), '')
  );

  INSERT INTO public.pedido_detalles (
    pedido_id,
    producto_id,
    cantidad,
    precio,
    descuento,
    subtotal,
    nombre_producto_snapshot,
    descripcion_snapshot
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
    producto.descripcion
  FROM jsonb_to_recordset(p_items) AS item(producto_id uuid, cantidad integer)
  JOIN public.productos AS producto
    ON producto.id = item.producto_id
   AND producto.tienda_id = p_tienda_id
   AND producto.disponible = true;

  INSERT INTO public.pedido_estado_historial (
    pedido_id,
    estado_anterior,
    estado_nuevo,
    observacion
  ) VALUES (
    v_pedido_id,
    NULL,
    'pendiente',
    'Pedido creado desde checkout.'
  );

  RETURN v_pedido_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_pedido_checkout(
  uuid, jsonb, text, text, integer, numeric, numeric, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_pedido_checkout(
  uuid, jsonb, text, text, integer, numeric, numeric, text
) TO authenticated;