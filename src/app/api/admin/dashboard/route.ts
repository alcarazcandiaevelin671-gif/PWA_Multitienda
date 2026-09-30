import { NextResponse } from 'next/server';
import { isDeniedResponse, isPermissionError, requireAdmin } from '@/lib/admin-server';

export async function GET() {
  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;

  const { supabase } = access;
  const results = await Promise.all([
    supabase.from('usuarios').select('id', { count: 'exact', head: true }),
    supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('rol', 'cliente'),
    supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('rol', 'comerciante'),
    supabase.from('tiendas').select('id', { count: 'exact', head: true }),
    supabase.from('tiendas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabase.from('tiendas').select('id', { count: 'exact', head: true }).eq('estado', 'activa'),
    supabase.from('productos').select('id', { count: 'exact', head: true }).eq('disponible', true),
    supabase.from('pedidos').select('id', { count: 'exact', head: true }),
    supabase.from('ventas').select('id', { count: 'exact', head: true }),
    supabase.from('facturas').select('id', { count: 'exact', head: true }),
    supabase.from('tiendas').select('id', { count: 'exact', head: true }).eq('estado', 'rechazada'),
  ]);

  const queryError = results.find((result) => result.error)?.error;
  if (queryError) {
    return NextResponse.json(
      { error: isPermissionError(queryError) ? 'La política RLS no permite consultar todos los indicadores.' : 'No se pudieron cargar los indicadores.' },
      { status: isPermissionError(queryError) ? 403 : 502 }
    );
  }

  const [users, customers, vendors, shops, pendingShops, activeShops, products, orders, sales, invoices, rejectedShops] = results;
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { start: date, end: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
  });
  const trends = await Promise.all(months.flatMap(({ start, end }) => [
    supabase.from('pedidos').select('id', { count: 'exact', head: true }).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
    supabase.from('ventas').select('id', { count: 'exact', head: true }).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
  ]));
  const trendError = trends.find((result) => result.error)?.error;
  if (trendError) {
    return NextResponse.json(
      { error: isPermissionError(trendError) ? 'La política RLS no permite consultar las tendencias.' : 'No se pudieron cargar las tendencias.' },
      { status: isPermissionError(trendError) ? 403 : 502 }
    );
  }

  const [districtsResult, categoriesResult] = await Promise.all([
    supabase.from('distritos').select('id, nombre').order('nombre').limit(100),
    supabase.from('categorias').select('id, nombre').order('nombre').limit(100),
  ]);
  const dimensionError = districtsResult.error || categoriesResult.error;
  if (dimensionError) {
    return NextResponse.json(
      { error: isPermissionError(dimensionError) ? 'La política RLS no permite consultar las distribuciones.' : 'No se pudieron cargar las distribuciones.' },
      { status: isPermissionError(dimensionError) ? 403 : 502 }
    );
  }

  const [districtCounts, categoryCounts] = await Promise.all([
    Promise.all((districtsResult.data ?? []).map(async (district) => {
      const result = await supabase.from('tiendas').select('id', { count: 'exact', head: true }).eq('distrito_id', district.id);
      return { name: district.nombre, count: result.count ?? 0, error: result.error };
    })),
    Promise.all((categoriesResult.data ?? []).map(async (category) => {
      const result = await supabase.from('productos').select('id', { count: 'exact', head: true }).eq('categoria_id', category.id);
      return { name: category.nombre, count: result.count ?? 0, error: result.error };
    })),
  ]);
  const distributionError = [...districtCounts, ...categoryCounts].find((item) => item.error)?.error;
  if (distributionError) {
    return NextResponse.json(
      { error: isPermissionError(distributionError) ? 'La política RLS no permite consultar las distribuciones.' : 'No se pudieron cargar las distribuciones.' },
      { status: isPermissionError(distributionError) ? 403 : 502 }
    );
  }

  const activityResult = await supabase
    .from('auditorias')
    .select('id, accion, tabla_afectada, fecha_hora')
    .order('fecha_hora', { ascending: false })
    .limit(8);

  return NextResponse.json({
    counts: {
      users: users.count ?? 0,
      customers: customers.count ?? 0,
      vendors: vendors.count ?? 0,
      shops: shops.count ?? 0,
      pendingShops: pendingShops.count ?? 0,
      activeShops: activeShops.count ?? 0,
      products: products.count ?? 0,
      orders: orders.count ?? 0,
      sales: sales.count ?? 0,
      invoices: invoices.count ?? 0,
    },
    trends: months.map(({ start }, index) => ({
      month: new Intl.DateTimeFormat('es-PY', { month: 'short' }).format(start),
      orders: trends[index * 2].count ?? 0,
      sales: trends[index * 2 + 1].count ?? 0,
    })),
    districts: districtCounts.map(({ name, count }) => ({ name, count })).filter((item) => item.count > 0),
    categories: categoryCounts.map(({ name, count }) => ({ name, count })).filter((item) => item.count > 0),
    shopStatuses: [
      { name: 'Pendientes', count: pendingShops.count ?? 0 },
      { name: 'Activos', count: activeShops.count ?? 0 },
      { name: 'Rechazados', count: rejectedShops.count ?? 0 },
    ].filter((item) => item.count > 0),
    activity: activityResult.error ? [] : activityResult.data ?? [],
    activityUnavailable: Boolean(activityResult.error),
  });
}