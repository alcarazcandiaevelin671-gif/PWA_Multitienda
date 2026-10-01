import { supabase } from '@/lib/supabase';
import type { FacturaDetalle, FacturaInterna } from '@/types/database';
import { getCurrentUser, isMissingTableError } from '@/services/orders.service';

export async function getMyInvoices(): Promise<FacturaInterna[]> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('facturas')
      .select('*')
      .eq('cliente_id', user.id)
      .order('fecha', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data || []) as FacturaInterna[];
  } catch (error) {
    if (error instanceof Error && isMissingTableError(error)) return [];
    throw error;
  }
}

export async function getMyStoreInvoices(): Promise<FacturaInterna[]> {
  try {
    const user = await getCurrentUser();
    const { data: tiendas, error: tiendaError } = await supabase
      .from('tiendas')
      .select('id')
      .eq('usuario_id', user.id);

    if (tiendaError) {
      if (isMissingTableError(tiendaError)) return [];
      throw tiendaError;
    }

    if (!tiendas || tiendas.length === 0) return [];
    const storeIds = tiendas.map((tienda) => tienda.id).filter(Boolean);

    const { data, error } = await supabase
      .from('facturas')
      .select('*')
      .in('tienda_id', storeIds)
      .order('fecha', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data || []) as FacturaInterna[];
  } catch (error) {
    if (error instanceof Error && isMissingTableError(error)) return [];
    throw error;
  }
}

export async function getMyStoreInvoiceById(invoiceId: string) {
  const user = await getCurrentUser();
  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (String(profile?.rol ?? '').trim().toLowerCase() !== 'comerciante') {
    throw new Error('Esta factura solo está disponible para el comerciante de la tienda.');
  }

  const { data: stores, error: storesError } = await supabase
    .from('tiendas')
    .select('id, nombre_comercio')
    .eq('usuario_id', user.id);
  if (storesError) throw storesError;
  const storeIds = (stores ?? []).map((store) => store.id).filter(Boolean);
  if (storeIds.length === 0) return null;

  const { data: invoice, error: invoiceError } = await supabase
    .from('facturas')
    .select('*')
    .eq('id', invoiceId)
    .in('tienda_id', storeIds)
    .maybeSingle();
  if (invoiceError) throw invoiceError;
  if (!invoice) return null;

  const { data: details, error: detailsError } = await supabase
    .from('factura_detalles')
    .select('*')
    .eq('factura_id', invoiceId)
    .order('created_at', { ascending: true });
  if (detailsError) throw detailsError;

  const [saleResult, orderResult] = await Promise.all([
    supabase.from('ventas').select('id, numero_venta, estado, total, metodo_pago, created_at').eq('id', invoice.venta_id).eq('tienda_id', invoice.tienda_id).maybeSingle(),
    supabase.from('pedidos').select('id, numero_pedido, estado, estado_pago, total, created_at').eq('id', invoice.pedido_id).eq('tienda_id', invoice.tienda_id).maybeSingle(),
  ]);

  return {
    invoice: invoice as unknown as FacturaInterna,
    storeName: stores?.find((store) => store.id === invoice.tienda_id)?.nombre_comercio ?? '',
    details: (details ?? []) as unknown as FacturaDetalle[],
    sale: saleResult.data ?? null,
    order: orderResult.data ?? null,
  };
}

export async function getInvoiceById(invoiceId: string) {
  try {
    const user = await getCurrentUser();

    const { data: invoice, error: invoiceError } = await supabase
      .from('facturas')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceError) {
      if (isMissingTableError(invoiceError)) return null;
      throw invoiceError;
    }

    if (!invoice) return null;

    const hasAccess = invoice.cliente_id === user.id || invoice.tienda_id === (await supabase.from('tiendas').select('id').eq('usuario_id', user.id).then((result) => result.data?.[0]?.id ?? null));

    if (!hasAccess) {
      return null;
    }

    const { data: details, error: detailError } = await supabase
      .from('factura_detalles')
      .select('*')
      .eq('factura_id', invoiceId)
      .order('created_at', { ascending: true });

    if (detailError && !isMissingTableError(detailError)) throw detailError;

    return {
      factura: invoice as FacturaInterna,
      detalles: (details || []) as FacturaDetalle[],
    };
  } catch (error) {
    if (error instanceof Error && isMissingTableError(error)) return null;
    throw error;
  }
}
