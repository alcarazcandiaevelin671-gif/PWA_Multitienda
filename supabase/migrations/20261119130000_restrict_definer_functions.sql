-- =====================================================================
-- Seguimiento de la auditoría: funciones SECURITY DEFINER ejecutables por anon
-- (principio de mínimo privilegio · ISO/IEC 27002:2022 8.2 y 8.3 · OWASP A01).
-- Ejecutar completo en Supabase > SQL Editor. Es idempotente.
-- =====================================================================

-- 1) notificar_a_todos_los_clientes: la app no la usa y permitía que cualquiera
--    (incluso sin sesión) enviara notificaciones masivas a todos los clientes.
--    Queda solo para el servidor (service_role) y el SQL Editor.
DO $$
BEGIN
  IF to_regprocedure('public.notificar_a_todos_los_clientes(text,text,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.notificar_a_todos_los_clientes(text, text, text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.notificar_a_todos_los_clientes(text, text, text, text) TO service_role;
  END IF;
END
$$;

-- 2) Funciones de trigger: nunca deben llamarse por la API. Los triggers siguen
--    funcionando porque PostgreSQL no verifica EXECUTE al dispararlos.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS firma
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.firma);
    RAISE NOTICE 'Trigger protegido: %', f.firma;
  END LOOP;
END
$$;

-- 3) es_comerciante_o_admin() se usa en políticas que también evalúan peticiones
--    anónimas: debe poder ejecutarse (devuelve false para anónimos). Así el listado
--    de buckets responde "vacío" en lugar de un error de permisos.
GRANT EXECUTE ON FUNCTION public.es_comerciante_o_admin() TO anon, authenticated;

-- 4) Verificación: funciones DEFINER que siguen ejecutables por anon (deben ser
--    solo las intencionales: estadísticas públicas y es_administrador_actual).
SELECT p.oid::regprocedure::text AS funcion_ejecutable_por_anon
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY 1;
