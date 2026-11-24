-- =====================================================================
-- Módulo geoespacial (PostGIS) y datos para el filtrado colaborativo
--
-- 1) tiendas_cercanas(): consulta espacial en la BASE DE DATOS con PostGIS.
--    Calcula la distancia real sobre el elipsoide (ST_Distance sobre geography,
--    en metros) entre el usuario y cada comercio activo, filtra por radio con
--    ST_DWithin (usa el índice GIST idx_tiendas_geo) y por municipio/categoría.
--    La usa el mapa de comercios (/comercios) y el motor de recomendación.
--
-- 2) recomendacion_cestas(): devuelve "cestas" ANÓNIMAS de productos
--    (productos de un mismo pedido, o favoritos de un mismo usuario) para el
--    filtrado colaborativo ítem-ítem. No devuelve ningún dato personal: ni
--    usuario, ni pedido, ni fechas. Solo la ejecuta el servidor (service_role).
-- =====================================================================

-- 1) Comercios cercanos ------------------------------------------------
CREATE OR REPLACE FUNCTION public.tiendas_cercanas(
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_radio_km double precision DEFAULT NULL,
  p_distrito_id integer DEFAULT NULL,
  p_categoria text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  slug text,
  nombre_comercio text,
  descripcion text,
  categoria_principal text,
  logo_url text,
  portada_url text,
  whatsapp text,
  latitud double precision,
  longitud double precision,
  distrito_id integer,
  distrito text,
  distancia_km double precision,
  total_productos integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER          -- respeta RLS: solo lo que el visitante puede ver
SET search_path = ''
AS $$
  WITH origen AS (
    SELECT CASE
      WHEN p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180
        THEN extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
    END AS punto
  )
  SELECT
    t.id,
    t.slug::text,
    t.nombre_comercio::text,
    t.descripcion::text,
    t.categoria_principal::text,
    t.logo_url::text,
    t.portada_url::text,
    t.whatsapp::text,
    t.latitud::double precision,
    t.longitud::double precision,
    t.distrito_id,
    d.nombre::text,
    CASE WHEN o.punto IS NOT NULL AND t.ubicacion IS NOT NULL
      THEN round((extensions.st_distance(t.ubicacion, o.punto) / 1000.0)::numeric, 3)::double precision
    END AS distancia_km,
    (SELECT count(*)::integer FROM public.productos p
      WHERE p.tienda_id = t.id AND p.disponible AND p.eliminado_en IS NULL) AS total_productos
  FROM public.tiendas t
  CROSS JOIN origen o
  LEFT JOIN public.distritos d ON d.id = t.distrito_id
  WHERE t.estado = 'activa'
    AND t.eliminado_en IS NULL
    AND (p_distrito_id IS NULL OR t.distrito_id = p_distrito_id)
    AND (p_categoria IS NULL OR p_categoria = '' OR t.categoria_principal = p_categoria)
    AND (
      p_radio_km IS NULL OR o.punto IS NULL
      OR (t.ubicacion IS NOT NULL AND extensions.st_dwithin(t.ubicacion, o.punto, p_radio_km * 1000))
    )
  ORDER BY distancia_km ASC NULLS LAST, t.nombre_comercio;
$$;

COMMENT ON FUNCTION public.tiendas_cercanas(double precision, double precision, double precision, integer, text)
  IS 'Comercios activos ordenados por distancia real (PostGIS ST_Distance/ST_DWithin), con filtros de radio, municipio y categoría.';
REVOKE ALL ON FUNCTION public.tiendas_cercanas(double precision, double precision, double precision, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tiendas_cercanas(double precision, double precision, double precision, integer, text) TO anon, authenticated, service_role;

-- 2) Cestas anónimas para el filtrado colaborativo ---------------------
CREATE OR REPLACE FUNCTION public.recomendacion_cestas()
RETURNS TABLE (origen text, productos uuid[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Productos comprados juntos en un mismo pedido (no cancelado)
  SELECT 'pedido'::text, array_agg(DISTINCT detalle.producto_id)
  FROM public.pedido_detalles detalle
  JOIN public.pedidos pedido ON pedido.id = detalle.pedido_id
  WHERE detalle.producto_id IS NOT NULL
    AND pedido.estado::text <> 'cancelado'
    AND pedido.eliminado_en IS NULL
    AND detalle.eliminado_en IS NULL
  GROUP BY detalle.pedido_id
  UNION ALL
  -- Productos que un mismo usuario marcó como favoritos
  SELECT 'favoritos'::text, array_agg(DISTINCT favorito.producto_id)
  FROM public.favoritos favorito
  WHERE favorito.producto_id IS NOT NULL AND favorito.eliminado_en IS NULL
  GROUP BY favorito.usuario_id;
$$;

COMMENT ON FUNCTION public.recomendacion_cestas()
  IS 'Cestas anónimas de productos (por pedido y por favoritos de un usuario) para el filtrado colaborativo ítem-ítem. Sin datos personales.';
REVOKE ALL ON FUNCTION public.recomendacion_cestas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recomendacion_cestas() TO service_role;
