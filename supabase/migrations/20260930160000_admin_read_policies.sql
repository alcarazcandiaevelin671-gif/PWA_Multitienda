CREATE OR REPLACE FUNCTION public.es_administrador_actual()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios AS usuario
    WHERE usuario.id = (SELECT auth.uid())
      AND lower(usuario.rol::text) IN ('admin', 'administrador')
  );
$$;

REVOKE ALL ON FUNCTION public.es_administrador_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_administrador_actual() TO authenticated;

DO $$
DECLARE
  table_name text;
  policy_name text;
  row_security_enabled boolean;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'usuarios',
    'tiendas',
    'productos',
    'pedidos',
    'pedido_detalles',
    'pedido_estado_historial',
    'ventas',
    'venta_detalles',
    'facturas',
    'factura_detalles',
    'categorias',
    'departamentos',
    'distritos',
    'auditorias',
    'notificaciones'
  ] LOOP
    SELECT relation.relrowsecurity
      INTO row_security_enabled
      FROM pg_class AS relation
      JOIN pg_namespace AS schema ON schema.oid = relation.relnamespace
     WHERE schema.nspname = 'public'
       AND relation.relname = table_name
       AND relation.relkind IN ('r', 'p');

    policy_name := 'admin_read_' || table_name;
    IF row_security_enabled IS TRUE
       AND NOT EXISTS (
         SELECT 1
           FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = table_name
            AND policyname = policy_name
       ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (public.es_administrador_actual())',
        policy_name,
        table_name
      );
    END IF;
  END LOOP;
END;
$$;