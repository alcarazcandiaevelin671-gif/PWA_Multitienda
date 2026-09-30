import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { CheckoutInput } from '@/types/database';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCheckoutInput(value: unknown): value is CheckoutInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as Partial<CheckoutInput>;

  return Boolean(
    typeof input.tienda_id === 'string'
    && UUID_PATTERN.test(input.tienda_id)
    && Array.isArray(input.items)
    && input.items.length > 0
    && input.items.length <= 50
    && input.items.every((item) => (
      item
      && typeof item.producto_id === 'string'
      && UUID_PATTERN.test(item.producto_id)
      && Number.isInteger(item.cantidad)
      && item.cantidad >= 1
      && item.cantidad <= 99
    ))
    && ['efectivo', 'transferencia'].includes(String(input.metodo_pago))
    && typeof input.direccion_entrega === 'string'
    && input.direccion_entrega.trim().length >= 3
    && input.direccion_entrega.length <= 500
    && (input.distrito_id == null || Number.isInteger(input.distrito_id))
    && (input.latitud == null || (Number.isFinite(input.latitud) && input.latitud >= -90 && input.latitud <= 90))
    && (input.longitud == null || (Number.isFinite(input.longitud) && input.longitud >= -180 && input.longitud <= 180))
    && ((input.latitud == null) === (input.longitud == null))
    && (input.notas == null || (typeof input.notas === 'string' && input.notas.length <= 1000))
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo de la solicitud no es JSON válido.' }, { status: 400 });
  }

  if (!isCheckoutInput(body)) {
    return NextResponse.json({ error: 'Revisa los datos del checkout e inténtalo nuevamente.' }, { status: 422 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Inicia sesión para confirmar tu pedido.' }, { status: 401 });
  }

  const { data: createdRecords, error: createError } = await supabase.rpc('procesar_checkout_pedido_venta_factura', {
    p_tienda_id: body.tienda_id,
    p_items: body.items.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })),
    p_metodo_pago: body.metodo_pago,
    p_direccion_entrega: body.direccion_entrega.trim(),
    p_distrito_id: body.distrito_id ?? null,
    p_latitud: body.latitud ?? null,
    p_longitud: body.longitud ?? null,
    p_notas: body.notas?.trim() || null,
  });

  if (createError || !createdRecords || typeof createdRecords !== 'object' || !('pedido_id' in createdRecords)) {
    const message = createError?.message || 'La base de datos no devolvió el identificador del pedido.';
    const migrationMissing = /procesar_checkout_pedido_venta_factura|schema cache|could not find the function/i.test(message);
    return NextResponse.json(
      { error: migrationMissing ? 'Las funciones de checkout aún no están instaladas en Supabase. Ejecuta la migración 20260929130000_checkout_sale_invoice.sql.' : message },
      { status: migrationMissing ? 503 : 422 }
    );
  }

  const registros = createdRecords as { pedido_id: string; numero_pedido: string; venta_id: string; factura_id: string };
  if (!registros.pedido_id || !registros.numero_pedido || !registros.venta_id || !registros.factura_id) {
    return NextResponse.json({ error: 'La base de datos no devolvió todos los identificadores creados.' }, { status: 500 });
  }

  return NextResponse.json({
    pedido: {
      id: registros.pedido_id,
      numero_pedido: registros.numero_pedido,
      estado: 'pendiente',
    },
    registros,
  }, { status: 201 });
}