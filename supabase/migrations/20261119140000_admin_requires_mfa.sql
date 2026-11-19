-- =====================================================================
-- MFA obligatorio para administradores (ISO/IEC 27002:2022 8.5 · OWASP ASVS V2.8)
--
-- es_administrador_actual() es la base de todas las políticas RLS y triggers
-- de administración. Ahora además exige que el token de la sesión tenga
-- aal = 'aal2' (contraseña + código TOTP verificado). Con solo la contraseña,
-- un administrador no puede leer ni modificar datos de administración, ni
-- siquiera llamando a la API de Supabase directamente.
--
-- ANTES de ejecutar: el administrador debe haber configurado su código en
-- la app (/auth/mfa se abre solo al entrar a /admin). Si algún administrador
-- pierde el acceso, se puede revertir ejecutando la versión anterior
-- (supabase/migrations/20260930160000_admin_read_policies.sql, primera función).
-- Ejecutar completo en Supabase > SQL Editor. Es idempotente.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.es_administrador_actual()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM public.usuarios AS usuario
      WHERE usuario.id = (SELECT auth.uid())
        AND usuario.activo = true
        AND lower(usuario.rol::text) IN ('admin', 'administrador')
    );
$$;

-- Verificación: administradores y si ya tienen un factor TOTP verificado.
SELECT u.email,
       u.rol,
       EXISTS (
         SELECT 1 FROM auth.mfa_factors f
         WHERE f.user_id = u.id AND f.factor_type = 'totp' AND f.status = 'verified'
       ) AS tiene_totp_verificado
FROM public.usuarios u
WHERE lower(u.rol::text) IN ('admin', 'administrador')
ORDER BY u.email;
