CREATE POLICY admin_update_distritos
ON public.distritos
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (public.es_administrador_actual())
WITH CHECK (public.es_administrador_actual());