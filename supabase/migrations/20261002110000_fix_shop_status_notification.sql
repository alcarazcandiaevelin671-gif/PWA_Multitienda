CREATE OR REPLACE FUNCTION public.fn_notificar_vendedor_estado_tienda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF OLD.estado = 'pendiente' AND NEW.estado = 'activa' THEN
        INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, link, leida)
        VALUES (
            NEW.id_vendedor,
            '¡Comercio Aprobado!',
            CONCAT('Tu comercio "', NEW.nombre, '" ha sido aprobado exitosamente y ya está visible.'),
            'comercio_aprobado',
            '/vendedor/tienda',
            FALSE
        );
    ELSIF OLD.estado = 'pendiente' AND NEW.estado = 'rechazada' THEN
        INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, link, leida)
        VALUES (
            NEW.id_vendedor,
            'Solicitud Rechazada',
            CONCAT('La solicitud para tu comercio "', NEW.nombre, '" ha sido rechazada.'),
            'comercio_rechazado',
            '/vendedor/tienda',
            FALSE
        );
    END IF;
    RETURN NEW;
END;
$function$;