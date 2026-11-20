DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notificaciones'
      AND policyname = 'notificaciones_insert_own'
  ) THEN
    CREATE POLICY notificaciones_insert_own
      ON public.notificaciones
      FOR INSERT
      TO authenticated
      WITH CHECK (usuario_id = (SELECT auth.uid()));
  END IF;
END;
$$;