import { NextResponse, type NextRequest } from 'next/server';
import { isDeniedResponse, isPermissionError, requireAdmin } from '@/lib/admin-server';

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;

  const params = request.nextUrl.searchParams;
  const parsePage = (value: string | null) => {
    const page = Number(value);
    return Number.isSafeInteger(page) && page > 0 ? page : 1;
  };
  const salesPage = parsePage(params.get('salesPage'));
  const ordersPage = parsePage(params.get('ordersPage'));
  const from = params.get('from');
  const to = params.get('to');
  const district = params.get('district');
  const category = params.get('category');
  const shop = params.get('shop');
  const status = params.get('status');
  const validDate = (value: string | null) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!validDate(from) || !validDate(to)) return NextResponse.json({ error: 'El rango de fechas no es válido.' }, { status: 400 });
  if (from && to && from > to) return NextResponse.json({ error: 'La fecha inicial debe ser anterior a la fecha final.' }, { status: 400 });

  const { supabase } = access;
  const [districtsResult, categoriesResult, shopsResult] = await Promise.all([
    supabase.from('distritos').select('id, nombre').order('nombre').limit(200),
    supabase.from('categorias').select('id, nombre').order('nombre').limit(200),
    supabase.from('tiendas').select('id, nombre_comercio, distrito_id').order('nombre_comercio').limit(500),
  ]);
  const optionError = districtsResult.error || categoriesResult.error || shopsResult.error;
  if (optionError) {
    return NextResponse.json(
      { error: isPermissionError(optionError) ? 'La política RLS no permite consultar los filtros del reporte.' : 'No se pudieron cargar los filtros.' },
      { status: isPermissionError(optionError) ? 403 : 502 }
    );
  }

  let storeIds: string[] | null = null;
  if (district) {
    storeIds = (shopsResult.data ?? []).filter((item) => String(item.distrito_id) === district).map((item) => item.id);
  }
  if (shop) storeIds = storeIds ? storeIds.filter((id) => id === shop) : [shop];

  let salesIds: string[] | null = null;
  let orderIds: string[] | null = null;
  if (category) {
    const { data: products, error: productsError } = await supabase.from('productos').select('id').eq('categoria_id', Number(category)).limit(1000);
    if (productsError) {
      return NextResponse.json(
        { error: isPermissionError(productsError) ? 'La política RLS no permite filtrar por categoría.' : 'No se pudieron consultar los productos de la categoría.' },
        { status: isPermissionError(productsError) ? 403 : 502 }
      );
    }
    const productIds = (products ?? []).map((item) => item.id);
    if (productIds.length === 0) {
      salesIds = [];
      orderIds = [];
    } else {
      const [saleItems, orderItems] = await Promise.all([
        supabase.from('venta_detalles').select('venta_id').in('producto_id', productIds).limit(5000),
        supabase.from('pedido_detalles').select('pedido_id').in('producto_id', productIds).limit(5000),
      ]);
      const detailError = saleItems.error || orderItems.error;
      if (detailError) {
        return NextResponse.json(
          { error: isPermissionError(detailError) ? 'La política RLS no permite filtrar los detalles por categoría.' : 'No se pudieron consultar los detalles por categoría.' },
          { status: isPermissionError(detailError) ? 403 : 502 }
        );
      }
      salesIds = Array.from(new Set((saleItems.data ?? []).map((item) => item.venta_id)));
      orderIds = Array.from(new Set((orderItems.data ?? []).map((item) => item.pedido_id)));
    }
  }

  let salesQuery = supabase.from('ventas').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE - 1);
  let ordersQuery = supabase.from('pedidos').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE - 1);
  if (from) {
    salesQuery = salesQuery.gte('created_at', `${from}T00:00:00.000Z`);
    ordersQuery = ordersQuery.gte('created_at', `${from}T00:00:00.000Z`);
  }
  if (to) {
    const endExclusive = new Date(`${to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    salesQuery = salesQuery.lt('created_at', endExclusive.toISOString());
    ordersQuery = ordersQuery.lt('created_at', endExclusive.toISOString());
  }
  if (status) {
    salesQuery = salesQuery.eq('estado', status);
    ordersQuery = ordersQuery.eq('estado', status);
  }
  if (storeIds) {
    if (storeIds.length === 0) {
      salesIds = [];
      orderIds = [];
    } else {
      salesQuery = salesQuery.in('tienda_id', storeIds);
      ordersQuery = ordersQuery.in('tienda_id', storeIds);
    }
  }
  if (salesIds) salesQuery = salesQuery.in('id', salesIds);
  if (orderIds) ordersQuery = ordersQuery.in('id', orderIds);

  const [salesResult, ordersResult] = await Promise.all([salesQuery, ordersQuery]);
  const dataError = salesResult.error || ordersResult.error;
  if (dataError) {
    return NextResponse.json(
      { error: isPermissionError(dataError) ? 'La política RLS no permite consultar los resultados del reporte.' : 'No se pudieron cargar los resultados.' },
      { status: isPermissionError(dataError) ? 403 : 502 }
    );
  }

  const statuses = Array.from(new Set([
    ...(salesResult.data ?? []).map((item) => item.estado),
    ...(ordersResult.data ?? []).map((item) => item.estado),
  ].filter((value): value is string => Boolean(value))));

  return NextResponse.json({
    sales: salesResult.data ?? [],
    salesTotal: salesResult.count ?? 0,
    salesPage,
    orders: ordersResult.data ?? [],
    ordersTotal: ordersResult.count ?? 0,
    ordersPage,
    pageSize: PAGE_SIZE,
    statuses,
    options: {
      districts: districtsResult.data ?? [],
      categories: categoriesResult.data ?? [],
      shops: shopsResult.data ?? [],
    },
  });
}