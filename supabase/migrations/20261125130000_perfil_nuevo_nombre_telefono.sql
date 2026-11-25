-- Con la confirmación de correo activa, el perfil de una cuenta nueva lo crea este trigger. Leía solo
-- "full_name" (Google), pero el formulario envía "nombre_completo" y "telefono_contacto": la cuenta
-- quedaba con el correo como nombre y sin teléfono. Solo afecta a cuentas nuevas.
-- El rol NUNCA se toma de los metadatos: toda cuenta empieza como cliente.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  meta jsonb := COALESCE(new.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.usuarios (id, email, nombre_completo, telefono_contacto, rol)
  VALUES (
    new.id,
    new.email,
    left(COALESCE(
      NULLIF(btrim(meta->>'nombre_completo'), ''), -- formulario de registro
      NULLIF(btrim(meta->>'full_name'), ''),       -- Google
      NULLIF(btrim(meta->>'name'), ''),
      new.email
    ), 150),
    left(NULLIF(btrim(meta->>'telefono_contacto'), ''), 50),
    'cliente' -- Todos inician como cliente por defecto
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;
