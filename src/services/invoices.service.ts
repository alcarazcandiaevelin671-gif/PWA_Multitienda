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
