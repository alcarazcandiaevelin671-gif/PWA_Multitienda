import { supabase } from '@/lib/supabase';
import type { Venta } from '@/types/database';
import { getCurrentUser, isMissingTableError } from '@/services/orders.service';

export async function getMyStoreSales(): Promise<Venta[]> {
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
      .from('ventas')
      .select('*')
      .in('tienda_id', storeIds)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data || []) as Venta[];
  } catch (error) {
    if (error instanceof Error && isMissingTableError(error)) return [];
    throw error;
  }
}

export async function getMyStoreSalesStats() {
  const sales = await getMyStoreSales();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const total = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const ventasHoy = sales.filter((sale) => {
    const createdAt = new Date(sale.created_at);
    return createdAt.toDateString() === today.toDateString();
  });
  const ventasMes = sales.filter((sale) => {
    const createdAt = new Date(sale.created_at);
    return createdAt >= monthStart;
  });

  return {
    totalVentas: total,
    ventasHoy: ventasHoy.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    ventasMes: ventasMes.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    cantidadOperaciones: sales.length,
    promedioPorVenta: sales.length > 0 ? total / sales.length : 0,
  };
}
