DO $$
BEGIN
  IF to_regclass('public.notificaciones') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notificaciones'
      AND policyname = 'notificaciones_select_own'
  ) THEN
    CREATE POLICY notificaciones_select_own
      ON public.notificaciones
      FOR SELECT
      TO authenticated
      USING (usuario_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notificaciones'
      AND policyname = 'notificaciones_update_own'
  ) THEN
    CREATE POLICY notificaciones_update_own
      ON public.notificaciones
      FOR UPDATE
      TO authenticated
      USING (usuario_id = (SELECT auth.uid()))
      WITH CHECK (usuario_id = (SELECT auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notificaciones'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END;
$$;