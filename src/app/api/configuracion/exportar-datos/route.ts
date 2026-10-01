import { requireActiveSettingsUser } from '@/lib/settings-server';
import { NextResponse } from 'next/server';

function isMissingTable(error: { code?: string; message?: string }) {
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || /relation .* does not exist|could not find the table|does not exist/i.test(error.message ?? '');
}

function isPermissionDenied(error: { code?: string; message?: string }) {
  return error.code === '42501' || /row level security|permission denied|insufficient privilege/i.test(error.message ?? '');
}

export async function GET() {
  const account = await requireActiveSettingsUser();
  if ('response' in account) return account.response;
  const { supabase, user } = account;

  const [profileResult, favoritesResult, interestsResult, historyResult, interactionsResult, ordersResult, notificationsResult, settingsResult, invoicesResult] = await Promise.all([
    supabase.from('usuarios').select('id, email, nombre_completo, telefono_contacto, rol, activo, creado_en, actualizado_en').eq('id', user.id).maybeSingle(),
    supabase.from('favoritos').select('id, usuario_id, tienda_id, producto_id, creado_en').eq('usuario_id', user.id),
    supabase.from('preferencias_usuario').select('categoria').eq('usuario_id', user.id),
    supabase.from('historial_busquedas').select('id, termino, distrito_id, categoria_id, fecha_hora').eq('usuario_id', user.id),
    supabase.from('interacciones_clics').select('id, tienda_id, producto_id, tipo, fecha_hora').eq('usuario_id', user.id),
    supabase.from('pedidos').select('id, tienda_id, numero_pedido, estado, subtotal, descuento, envio, total, metodo_pago, estado_pago, direccion_entrega, distrito_id, latitud, longitud, notas, created_at, updated_at').eq('usuario_id', user.id).order('created_at', { ascending: false }),
    supabase.from('notificaciones').select('id, tipo, mensaje, leida, created_at, updated_at').eq('usuario_id', user.id),
    supabase.from('usuario_configuracion').select('preferencias, notificaciones_config, privacidad, created_at, updated_at').eq('usuario_id', user.id).maybeSingle(),
    supabase.from('facturas').select('id, pedido_id, numero, estado, fecha, moneda, subtotal, descuento, total, iva, created_at, updated_at').eq('cliente_id', user.id),
  ]);

  const requiredResults = [profileResult, favoritesResult, interestsResult, historyResult, interactionsResult, ordersResult, notificationsResult];
  const failed = requiredResults.find((result) => result.error && !isMissingTable(result.error))
    ?? (settingsResult.error && !isMissingTable(settingsResult.error) && !isPermissionDenied(settingsResult.error) ? settingsResult : null)
    ?? (invoicesResult.error && !isMissingTable(invoicesResult.error) && !isPermissionDenied(invoicesResult.error) ? invoicesResult : null);
  if (failed?.error) {
    return NextResponse.json({ error: 'No se pudieron reunir tus datos. Verifica las políticas RLS y vuelve a intentarlo.' }, { status: 403 });
  }

  const orders = ordersResult.data ?? [];
  const orderIds = orders.map((order) => order.id);
  const detailsResult = orderIds.length
    ? await supabase.from('pedido_detalles').select('id, pedido_id, producto_id, cantidad, precio, descuento, subtotal, nombre_producto_snapshot, descripcion_snapshot, created_at').in('pedido_id', orderIds)
    : { data: [], error: null };
  if (detailsResult.error && !isMissingTable(detailsResult.error)) {
    return NextResponse.json({ error: 'No se pudieron reunir los detalles de tus pedidos.' }, { status: 403 });
  }

  const storesResult = String(profileResult.data?.rol ?? '').toLowerCase() === 'comerciante'
    ? await supabase.from('tiendas').select('id, usuario_id, distrito_id, nombre_comercio, slug, descripcion, estado').eq('usuario_id', user.id)
    : { data: [], error: null };
  if (storesResult.error && !isMissingTable(storesResult.error)) {
    return NextResponse.json({ error: 'No se pudieron reunir los datos de tus comercios.' }, { status: 403 });
  }

  const invoiceIds = (invoicesResult.data ?? []).map((invoice) => invoice.id);
  const invoiceDetailsResult = invoiceIds.length
    ? await supabase.from('factura_detalles').select('id, factura_id, producto_id, cantidad, precio, descuento, subtotal, descripcion_snapshot, created_at').in('factura_id', invoiceIds)
    : { data: [], error: null };
  if (invoiceDetailsResult.error && !isMissingTable(invoiceDetailsResult.error) && !isPermissionDenied(invoiceDetailsResult.error)) {
    return NextResponse.json({ error: 'No se pudieron reunir los detalles de tus facturas.' }, { status: 403 });
  }

  const exportData = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      email_verified: Boolean(user.email_confirmed_at),
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      profile: profileResult.data,
    },
    settings: settingsResult.data ?? null,
    stores: storesResult.data ?? [],
    favorites: favoritesResult.data ?? [],
    shopping_interests: interestsResult.data ?? [],
    search_history: historyResult.data ?? [],
    interactions: interactionsResult.data ?? [],
    orders,
    order_details: detailsResult.data ?? [],
    notifications: notificationsResult.data ?? [],
    invoices: invoicesResult.error ? [] : invoicesResult.data ?? [],
    invoice_details: invoiceDetailsResult.error ? [] : invoiceDetailsResult.data ?? [],
    unavailable_sections: [
      ...(settingsResult.error && !isMissingTable(settingsResult.error) ? ['settings'] : []),
      ...(invoicesResult.error && !isMissingTable(invoicesResult.error) ? ['invoices'] : []),
      ...(invoiceDetailsResult.error && !isMissingTable(invoiceDetailsResult.error) ? ['invoice_details'] : []),
    ],
  };
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="mis-datos-${date}.json"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}