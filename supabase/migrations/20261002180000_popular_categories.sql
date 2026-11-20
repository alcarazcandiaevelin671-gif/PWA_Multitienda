CREATE OR REPLACE FUNCTION public.categorias_mas_interactuadas(p_limit integer DEFAULT 100)
RETURNS TABLE (categoria_id integer, puntuacion numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH eventos AS (
    SELECT producto.categoria_id,
      CASE interaccion.tipo::text
        WHEN 'compra' THEN 5::numeric
        WHEN 'favorito' THEN 4::numeric
        WHEN 'click' THEN 2::numeric
        WHEN 'contacto' THEN 2::numeric
        ELSE 1::numeric
      END AS puntos
    FROM public.interacciones_clics AS interaccion
    JOIN public.usuarios AS usuario ON usuario.id = interaccion.usuario_id
    JOIN public.productos AS producto ON producto.id = interaccion.producto_id
    WHERE lower(usuario.rol::text) = 'cliente'
      AND producto.categoria_id IS NOT NULL

    UNION ALL

    SELECT busqueda.categoria_id, 3::numeric
    FROM public.historial_busquedas AS busqueda
    JOIN public.usuarios AS usuario ON usuario.id = busqueda.usuario_id
    WHERE lower(usuario.rol::text) = 'cliente'
      AND busqueda.categoria_id IS NOT NULL

    UNION ALL

    SELECT producto.categoria_id, 4::numeric
    FROM public.favoritos AS favorito
    JOIN public.usuarios AS usuario ON usuario.id = favorito.usuario_id
    JOIN public.productos AS producto ON producto.id = favorito.producto_id
    WHERE lower(usuario.rol::text) = 'cliente'
      AND producto.categoria_id IS NOT NULL

    UNION ALL

    SELECT producto.categoria_id, (5 * detalle.cantidad)::numeric
    FROM public.pedido_detalles AS detalle
    JOIN public.pedidos AS pedido ON pedido.id = detalle.pedido_id
    JOIN public.usuarios AS usuario ON usuario.id = pedido.usuario_id
    JOIN public.productos AS producto ON producto.id = detalle.producto_id
    WHERE lower(usuario.rol::text) = 'cliente'
      AND pedido.estado <> 'cancelado'
      AND producto.categoria_id IS NOT NULL
  )
  SELECT categoria.id, coalesce(sum(eventos.puntos), 0)::numeric AS puntuacion
  FROM public.categorias AS categoria
  LEFT JOIN eventos ON eventos.categoria_id = categoria.id
  GROUP BY categoria.id, categoria.nombre
  ORDER BY puntuacion DESC, categoria.nombre ASC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500));
$function$;

REVOKE ALL ON FUNCTION public.categorias_mas_interactuadas(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.categorias_mas_interactuadas(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.registrar_interaccion_producto(
  p_producto_id uuid,
  p_tipo text DEFAULT 'click'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_tienda_id uuid;
BEGIN
  IF v_usuario_id IS NULL OR p_tipo IS NULL OR p_tipo NOT IN ('vista', 'click', 'favorito', 'compra', 'contacto') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    WHERE usuario.id = v_usuario_id
      AND lower(usuario.rol::text) = 'cliente'
  ) THEN
    RETURN;
  END IF;

  SELECT producto.tienda_id
    INTO v_tienda_id
    FROM public.productos AS producto
   WHERE producto.id = p_producto_id
     AND producto.disponible IS TRUE;

  IF v_tienda_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.interacciones_clics (usuario_id, tienda_id, producto_id, tipo, fecha_hora)
  VALUES (v_usuario_id, v_tienda_id, p_producto_id, p_tipo::public.tipo_interaccion, now());
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_interaccion_producto(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_interaccion_producto(uuid, text) TO authenticated;