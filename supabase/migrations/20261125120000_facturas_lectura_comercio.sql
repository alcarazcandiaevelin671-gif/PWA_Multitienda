-- El comerciante no veía las facturas de su tienda: facturas y factura_detalles solo tenían
-- política de lectura para el cliente y para el administrador. Se agrega la lectura del dueño
-- de la tienda (igual que en pedidos y ventas). Solo SELECT: no permite crear, cambiar ni borrar.
-- Sigue vigente la política restrictiva "Ocultar registros dados de baja".

DROP POLICY IF EXISTS facturas_select_store_owner ON public.facturas;
CREATE POLICY facturas_select_store_owner ON public.facturas
  FOR SELECT TO authenticated
  USING (
    tienda_id IN (
      SELECT t.id FROM public.tiendas AS t WHERE t.usuario_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS factura_detalles_select_store_owner ON public.factura_detalles;
CREATE POLICY factura_detalles_select_store_owner ON public.factura_detalles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.facturas AS f
      JOIN public.tiendas AS t ON t.id = f.tienda_id
      WHERE f.id = factura_detalles.factura_id
        AND t.usuario_id = (SELECT auth.uid())
    )
  );
