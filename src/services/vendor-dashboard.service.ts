import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/services/orders.service';
import type { Pedido, Venta } from '@/types/database';

export type VendorStoreOption = {
  id: string;
  nombre_comercio: string;
  estado: string;
};

export type VendorStoreDetail = VendorStoreOption & {
  slug: string | null;
  distrito_id: number | null;
  distrito_nombre: string | null;
  direccion_texto: string | null;
  latitud: number | null;
  longitud: number | null;
  creado_en: string | null;
};

export type VendorDashboardData = {
  merchantName: string;
  stores: VendorStoreOption[];
  selectedStoreId: string;
  counts: {
    stores: number;
    activeStores: number;
    products: number;
    availableProducts: number;
    orders: number;
    pendingOrders: number;
    sales: number;
    salesTotal: number;
    salesMonth: number;
    invoices: number;
  };
  recentOrders: Array<Pedido & { tienda_nombre: string }>;
  recentSales: Venta[];
  salesByDay: Array<{ day: string; total: number }>;
};

const PAGE_SIZE = 500;

async function fetchAllStoreSales(storeIds: string[]) {
  const rows: Venta[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('ventas')
      .select('*')
      .in('tienda_id', storeIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data ?? []) as unknown as Venta[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    offset += PAGE_SIZE;
  }
}

export async function getVendorDashboardData(selectedStoreId?: string): Promise<VendorDashboardData> {
  const user = await getCurrentUser();
  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('nombre_completo, rol, activo')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (profile?.activo !== true || String(profile.rol ?? '').trim().toLowerCase() !== 'comerciante') {
    throw new Error('Esta sección está disponible únicamente para comerciantes activos.');
  }

  const { data: storeRows, error: storesError } = await supabase
    .from('tiendas')
    .select('id, nombre_comercio, estado')
    .eq('usuario_id', user.id)
    .order('nombre_comercio');

  if (storesError) throw storesError;
  const stores = (storeRows ?? []) as unknown as VendorStoreOption[];
  const ownedStoreIds = new Set(stores.map((store) => store.id));

  if (selectedStoreId && !ownedStoreIds.has(selectedStoreId)) {
    throw new Error('La tienda seleccionada no pertenece a tu cuenta.');
  }

  const filteredStores = selectedStoreId
    ? stores.filter((store) => store.id === selectedStoreId)
    : stores;
  const storeIds = filteredStores.map((store) => store.id);
  const storeNames = new Map(filteredStores.map((store) => [store.id, store.nombre_comercio]));

  if (storeIds.length === 0) {
    return {
      merchantName: user.email || profile.nombre_completo || 'Comerciante',
      stores,
      selectedStoreId: '',
      counts: {
        stores: 0,
        activeStores: 0,
        products: 0,
        availableProducts: 0,
        orders: 0,
        pendingOrders: 0,
        sales: 0,
        salesTotal: 0,
        salesMonth: 0,
        invoices: 0,
      },
      recentOrders: [],
      recentSales: [],
      salesByDay: [],
    };
  }

  const [productsResult, availableProductsResult, ordersResult, sales, invoicesResult] = await Promise.all([
    supabase.from('productos').select('id', { count: 'exact', head: true }).in('tienda_id', storeIds),
    supabase.from('productos').select('id', { count: 'exact', head: true }).in('tienda_id', storeIds).eq('disponible', true),
    supabase.rpc('obtener_pedidos_mis_tiendas'),
    fetchAllStoreSales(storeIds),
    supabase.from('facturas').select('id', { count: 'exact', head: true }).in('tienda_id', storeIds),
  ]);

  const queryError = productsResult.error || availableProductsResult.error || ordersResult.error || invoicesResult.error;
  if (queryError) throw queryError;

  const allOrders = (ordersResult.data ?? []) as unknown as Pedido[];
  const orders = allOrders.filter((order) => storeNames.has(order.tienda_id));
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSales = sales.filter((sale) => new Date(sale.created_at) >= monthStart);
  const dailySales = new Map<string, number>();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const startDay = dateKey(startDate);
  const today = dateKey(now);

  for (const sale of sales) {
    const day = dateKey(new Date(sale.created_at));
    if (day >= startDay && day <= today) {
      dailySales.set(day, (dailySales.get(day) ?? 0) + Number(sale.total ?? 0));
    }
  }

  const salesByDay = dailySales.size === 0 ? [] : Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    const key = dateKey(day);
    return { day: key, total: dailySales.get(key) ?? 0 };
  });

  return {
    merchantName: user.email || profile?.nombre_completo || 'Comerciante',
    stores,
    selectedStoreId: selectedStoreId ?? '',
    counts: {
      stores: filteredStores.length,
      activeStores: filteredStores.filter((store) => ['activa', 'activo'].includes(store.estado.toLowerCase())).length,
      products: productsResult.count ?? 0,
      availableProducts: availableProductsResult.count ?? 0,
      orders: orders.length,
      pendingOrders: orders.filter((order) => order.estado === 'pendiente').length,
      sales: sales.length,
      salesTotal: sales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
      salesMonth: monthSales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
      invoices: invoicesResult.count ?? 0,
    },
    recentOrders: orders
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .slice(0, 5)
      .map((order) => ({ ...order, tienda_nombre: storeNames.get(order.tienda_id) ?? '' })),
    recentSales: sales.slice(0, 5),
    salesByDay,
  };
}

export async function getVendorStores(): Promise<VendorStoreDetail[]> {
  const user = await getCurrentUser();
  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (String(profile?.rol ?? '').trim().toLowerCase() !== 'comerciante') {
    throw new Error('Esta sección está disponible únicamente para comerciantes.');
  }

  const { data, error } = await supabase
    .from('tiendas')
    .select('id, nombre_comercio, estado, slug, distrito_id, direccion_texto, latitud, longitud, creado_en')
    .eq('usuario_id', user.id)
    .order('nombre_comercio');
  if (error) throw error;

  const stores = (data ?? []) as unknown as VendorStoreDetail[];
  const districtIds = Array.from(new Set(stores.map((store) => store.distrito_id).filter((id): id is number => id !== null)));
  if (districtIds.length === 0) return stores;

  const { data: districts, error: districtsError } = await supabase.from('distritos').select('id, nombre').in('id', districtIds);
  if (districtsError) throw districtsError;
  const districtNames = new Map((districts ?? []).map((district) => [district.id, district.nombre]));
  return stores.map((store) => ({ ...store, distrito_nombre: districtNames.get(store.distrito_id ?? -1) ?? null }));
}