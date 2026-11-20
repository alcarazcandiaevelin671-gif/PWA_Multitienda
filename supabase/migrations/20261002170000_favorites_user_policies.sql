ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.favoritos TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'favoritos'
      AND policyname = 'favoritos_select_own'
  ) THEN
    CREATE POLICY favoritos_select_own
      ON public.favoritos
      FOR SELECT TO authenticated
      USING (usuario_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'favoritos'
      AND policyname = 'favoritos_insert_own'
  ) THEN
    CREATE POLICY favoritos_insert_own
      ON public.favoritos
      FOR INSERT TO authenticated
      WITH CHECK (usuario_id = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'favoritos'
      AND policyname = 'favoritos_delete_own'
  ) THEN
    CREATE POLICY favoritos_delete_own
      ON public.favoritos
      FOR DELETE TO authenticated
      USING (usuario_id = (SELECT auth.uid()));
  END IF;
END;
$$;