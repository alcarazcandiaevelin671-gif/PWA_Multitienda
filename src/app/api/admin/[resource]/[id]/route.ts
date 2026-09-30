import { NextResponse, type NextRequest } from 'next/server';
import { isDeniedResponse, isPermissionError, requireAdmin } from '@/lib/admin-server';

const detailResources = ['pedidos', 'ventas', 'facturas'] as const;
type DetailResource = (typeof detailResources)[number];

function queryError(error: { code?: string; message?: string }) {
  const denied = isPermissionError(error);
  return NextResponse.json(
    { error: denied ? 'La política RLS no permite consultar los detalles de este registro.' : 'No se pudieron cargar los detalles.' },
    { status: denied ? 403 : 502 }
  );
}

export async function GET(_request: NextRequest, { params }: { params: { resource: string; id: string } }) {
  if (!detailResources.includes(params.resource as DetailResource)) {
    return NextResponse.json({ error: 'Esta sección no tiene detalle ampliado.' }, { status: 404 });
  }

  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;

  if (params.resource === 'pedidos') {
    const { data: pedido, error: pedidoError } = await access.supabase.from('pedidos').select('*').eq('id', params.id).maybeSingle();
    if (pedidoError) return queryError(pedidoError);
    if (!pedido) return NextResponse.json({ error: 'No se encontró el pedido.' }, { status: 404 });

    const [details, history] = await Promise.all([
      access.supabase.from('pedido_detalles').select('*').eq('pedido_id', params.id).order('created_at'),
      access.supabase.from('pedido_estado_historial').select('*').eq('pedido_id', params.id).order('created_at'),
    ]);
    const error = details.error || history.error;
    if (error) return queryError(error);
    return NextResponse.json({ details: details.data ?? [], history: history.data ?? [] });
  }

  if (params.resource === 'ventas') {
    const { data: sale, error: saleError } = await access.supabase.from('ventas').select('id').eq('id', params.id).maybeSingle();
    if (saleError) return queryError(saleError);
    if (!sale) return NextResponse.json({ error: 'No se encontró la venta.' }, { status: 404 });

    const { data, error } = await access.supabase.from('venta_detalles').select('*').eq('venta_id', params.id).order('created_at');
    if (error) return queryError(error);
    return NextResponse.json({ details: data ?? [], history: [] });
  }

  const { data: invoice, error: invoiceError } = await access.supabase.from('facturas').select('id').eq('id', params.id).maybeSingle();
  if (invoiceError) return queryError(invoiceError);
  if (!invoice) return NextResponse.json({ error: 'No se encontró la factura.' }, { status: 404 });

  const { data, error } = await access.supabase.from('factura_detalles').select('*').eq('factura_id', params.id).order('created_at');
  if (error) return queryError(error);
  return NextResponse.json({ details: data ?? [], history: [] });
}