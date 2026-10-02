ALTER TABLE public.historial_busquedas ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.historial_busquedas TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'historial_busquedas'
      AND policyname = 'historial_busquedas_select_own'
  ) THEN
    CREATE POLICY historial_busquedas_select_own
      ON public.historial_busquedas
      FOR SELECT
      TO authenticated
      USING (usuario_id = (SELECT auth.uid()));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_historial_busqueda(
  p_termino text,
  p_categoria_id integer DEFAULT NULL,
  p_distrito_id integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_termino text := left(trim(coalesce(p_termino, '')), 120);
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere iniciar sesión.' USING ERRCODE = '28000';
  END IF;

  IF length(v_termino) < 2 THEN
    RETURN;
  END IF;

  INSERT INTO public.historial_busquedas (usuario_id, termino, categoria_id, distrito_id, fecha_hora)
  VALUES (v_usuario_id, v_termino, p_categoria_id, p_distrito_id, now());
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_historial_busqueda(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_historial_busqueda(text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.productos_mas_comprados(p_limit integer DEFAULT 20)
RETURNS TABLE (producto_id uuid, unidades bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT detalle.producto_id, sum(detalle.cantidad)::bigint AS unidades
  FROM public.pedido_detalles AS detalle
  JOIN public.pedidos AS pedido ON pedido.id = detalle.pedido_id
  JOIN public.productos AS producto ON producto.id = detalle.producto_id
  WHERE detalle.producto_id IS NOT NULL
    AND producto.disponible IS TRUE
    AND pedido.estado <> 'cancelado'
  GROUP BY detalle.producto_id
  ORDER BY unidades DESC, detalle.producto_id
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$function$;

REVOKE ALL ON FUNCTION public.productos_mas_comprados(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.productos_mas_comprados(integer) TO anon, authenticated;