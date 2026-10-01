import { supabase } from '@/lib/supabase';
import { getCurrentUser, isMissingTableError, isPermissionError } from '@/services/orders.service';
import type { Pedido, Venta } from '@/types/database';
import type { VendorStoreOption } from '@/services/vendor-dashboard.service';

export type VendorReportProduct = {
  id: string;
  tienda_id: string;
  titulo: string;
  disponible: boolean;
  destacado: boolean;
  vistas_count: number;
  categoria_id: number | null;
};

export type VendorSaleItem = {
  id: string;
  venta_id: string;
  producto_id: string | null;
  cantidad: number;
  nombre_producto_snapshot: string;
};

export type VendorReportData = {
  merchantName: string;
  stores: VendorStoreOption[];
  selectedStoreId: string;
  sales: Venta[];
  orders: Pedido[];
  products: VendorReportProduct[];
  saleItems: VendorSaleItem[] | null;
  saleItemsError: string | null;
};

const PAGE_SIZE = 500;

function toStartOfLocalDay(value?: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function toEndExclusiveLocalDay(value?: string) {
  if (!value) return null;
  const end = new Date(`${value}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return end.toISOString();
}

async function loadSales(storeIds: string[], from?: string, to?: string) {
  const rows: Venta[] = [];
  const fromTimestamp = toStartOfLocalDay(from);
  const toTimestamp = toEndExclusiveLocalDay(to);

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from('ventas')
      .select('*')
      .in('tienda_id', storeIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (fromTimestamp) query = query.gte('created_at', fromTimestamp);
    if (toTimestamp) query = query.lt('created_at', toTimestamp);

    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as unknown as Venta[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function loadProducts(storeIds: string[]) {
  const rows: VendorReportProduct[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('productos')
      .select('id, tienda_id, titulo, disponible, destacado, vistas_count, categoria_id')
      .in('tienda_id', storeIds)
      .order('vistas_count', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as VendorReportProduct[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function loadSaleItems(saleIds: string[]) {
  const rows: VendorSaleItem[] = [];
  for (let start = 0; start < saleIds.length; start += 100) {
    const ids = saleIds.slice(start, start + 100);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('venta_detalles')
        .select('id, venta_id, producto_id, cantidad, nombre_producto_snapshot')
        .in('venta_id', ids)
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as unknown as VendorSaleItem[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

export async function getVendorReportData(filters: { storeId?: string; from?: string; to?: string } = {}): Promise<VendorReportData> {
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new Error('La fecha inicial debe ser anterior o igual a la fecha final.');
  }

  const user = await getCurrentUser();
  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('nombre_completo, rol')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (String(profile?.rol ?? '').trim().toLowerCase() !== 'comerciante') {
    throw new Error('Esta sección está disponible únicamente para comerciantes.');
  }

  const { data: storeRows, error: storesError } = await supabase
    .from('tiendas')
    .select('id, nombre_comercio, estado')
    .eq('usuario_id', user.id)
    .order('nombre_comercio');
  if (storesError) throw storesError;

  const stores = (storeRows ?? []) as unknown as VendorStoreOption[];
  const ownedIds = new Set(stores.map((store) => store.id));
  if (filters.storeId && !ownedIds.has(filters.storeId)) throw new Error('La tienda seleccionada no pertenece a tu cuenta.');
  const selectedStores = filters.storeId ? stores.filter((store) => store.id === filters.storeId) : stores;
  const storeIds = selectedStores.map((store) => store.id);

  const emptyResult = {
    merchantName: profile?.nombre_completo || user.email || 'Comerciante',
    stores,
    selectedStoreId: filters.storeId ?? '',
    sales: [],
    orders: [],
    products: [],
    saleItems: [] as VendorSaleItem[] | null,
    saleItemsError: null as string | null,
  };
  if (storeIds.length === 0) return emptyResult;

  const [sales, products, ordersResult] = await Promise.all([
    loadSales(storeIds, filters.from, filters.to),
    loadProducts(storeIds),
    supabase.rpc('obtener_pedidos_mis_tiendas'),
  ]);
  if (ordersResult.error) throw ordersResult.error;

  const saleIds = sales.map((sale) => sale.id);
  let saleItems: VendorSaleItem[] | null = [];
  let saleItemsError: string | null = null;
  if (saleIds.length > 0) {
    try {
      saleItems = await loadSaleItems(saleIds);
    } catch (error) {
      saleItems = null;
      saleItemsError = isPermissionError(error)
        ? 'Las políticas RLS no permiten consultar el detalle de productos vendidos.'
        : isMissingTableError(error)
          ? 'La tabla de detalles de ventas no está disponible en Supabase.'
          : 'No se pudieron cargar los detalles de ventas.';
    }
  }

  const selectedIds = new Set(storeIds);
  const fromTimestamp = toStartOfLocalDay(filters.from);
  const toTimestamp = toEndExclusiveLocalDay(filters.to);
  const orders = ((ordersResult.data ?? []) as unknown as Pedido[]).filter((order) => {
    if (!selectedIds.has(order.tienda_id)) return false;
    if (fromTimestamp && order.created_at < fromTimestamp) return false;
    if (toTimestamp && order.created_at >= toTimestamp) return false;
    return true;
  });

  return {
    ...emptyResult,
    sales,
    orders,
    products,
    saleItems,
    saleItemsError,
  };
}