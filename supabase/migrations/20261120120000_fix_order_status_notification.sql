-- =====================================================================
-- Corrige el trigger de notificaciones de pedidos.
-- Error: al confirmar/cambiar el estado de un pedido, el trigger usaba
-- NEW.id_cliente (columna inexistente: el cliente es pedidos.usuario_id) y
-- toda la operación fallaba con: record "new" has no field "id_cliente".
-- Además los enlaces apuntaban a /cliente/pedidos (ruta inexistente).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fn_notificar_pedidos_vendedor_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_numero text := upper(substring(replace(NEW.id::text, '-', ''), 1, 8));
  v_estado text := CASE lower(NEW.estado::text)
    WHEN 'pendiente' THEN 'Pendiente'
    WHEN 'confirmado' THEN 'Confirmado'
    WHEN 'en_preparacion' THEN 'En preparación'
    WHEN 'listo' THEN 'Listo para entregar'
    WHEN 'completado' THEN 'Completado'
    WHEN 'cancelado' THEN 'Cancelado'
    ELSE initcap(replace(NEW.estado::text, '_', ' '))
  END;
  v_vendedor uuid;
BEGIN
  -- 1. Pedido nuevo -> avisar al VENDEDOR (dueño de la tienda)
  IF TG_OP = 'INSERT' THEN
    SELECT tienda.usuario_id INTO v_vendedor FROM public.tiendas AS tienda WHERE tienda.id = NEW.tienda_id;
    IF v_vendedor IS NOT NULL THEN
      INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, link, leida)
      VALUES (
        v_vendedor,
        '¡Nuevo pedido recibido!',
        format('Recibiste el pedido #%s. Revísalo y confírmalo.', v_numero),
        'nuevo_pedido',
        '/vendedor/pedidos/' || NEW.id,
        false
      );
    END IF;

  -- 2. Cambio de estado -> avisar al CLIENTE (pedidos.usuario_id)
  ELSIF TG_OP = 'UPDATE' AND OLD.estado IS DISTINCT FROM NEW.estado AND NEW.usuario_id IS NOT NULL THEN
    INSERT INTO public.notificaciones (usuario_id, titulo, mensaje, tipo, link, leida)
    VALUES (
      NEW.usuario_id,
      'Estado de tu pedido actualizado',
      format('Tu pedido #%s ahora está: %s.', v_numero, v_estado),
      'estado_pedido',
      '/pedidos/' || NEW.id,
      false
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_notificar_pedidos_vendedor_cliente() FROM PUBLIC, anon, authenticated;
