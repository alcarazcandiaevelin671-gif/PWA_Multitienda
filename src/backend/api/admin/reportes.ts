/**
 * [BACKEND · API] Administración: reporte global de pedidos, comercios y usuarios por período (/api/admin/reportes).
 *
 * Ruta pública: src/app/api/admin/reportes/route.ts (solo reexporta este archivo).
 * Exige rol admin y MFA; las políticas RLS vuelven a comprobar el permiso en cada consulta.
 * Solo devuelve totales: ningún dato personal de clientes.
 */
import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { isDeniedResponse, isPermissionError, requireAdmin } from '@/backend/auth/require-admin';
import { buildAdminReport, type ReportOrder, type ReportShop, type ReportUser } from '@/shared/lib/admin-report';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 1000;
const MAX_ROWS = 20_000;
/** Paraguay usa UTC-3 todo el año desde octubre de 2024. */
const startOfDay = (value: string) => `${value}T00:00:00-03:00`;
const isDate = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(startOfDay(value)));

type ShopRow = Omit<ReportShop, 'distrito'> & { distritos: { nombre: string } | Array<{ nombre: string }> | null };

export async function GET(request: NextRequest) {
  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;

  const from = request.nextUrl.searchParams.get('desde') ?? '';
  const to = request.nextUrl.searchParams.get('hasta') ?? '';
  if ((from && !isDate(from)) || (to && !isDate(to)) || (from && to && from > to)) {
    return NextResponse.json({ error: 'El período no es válido.' }, { status: 400 });
  }
  const since = from ? startOfDay(from) : null;
  // Hasta el final de ese día: se compara con el inicio del siguiente.
  const until = to ? new Date(Date.parse(startOfDay(to)) + 86_400_000).toISOString() : null;
  const { supabase } = access;

  const readAll = async <T,>(table: 'pedidos' | 'usuarios', columns: string, dateColumn: string): Promise<T[]> => {
    const rows: T[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
      let query = supabase.from(table).select(columns).order(dateColumn, { ascending: true }).range(offset, offset + PAGE - 1);
      if (since) query = query.gte(dateColumn, since);
      if (until) query = query.lt(dateColumn, until);
      const { data, error } = await query;
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as T[]));
      if ((data ?? []).length < PAGE) break;
    }
    return rows;
  };

  try {
    const [orders, users, shopsResult] = await Promise.all([
      readAll<ReportOrder>('pedidos', 'id, tienda_id, estado, total, created_at', 'created_at'),
      readAll<ReportUser>('usuarios', 'rol, creado_en', 'creado_en'),
      supabase.from('tiendas').select('id, nombre_comercio, estado, distritos(nombre)'),
    ]);
    if (shopsResult.error) throw shopsResult.error;
    const shops: ReportShop[] = ((shopsResult.data ?? []) as unknown as ShopRow[]).map(({ distritos, ...shop }) => ({
      ...shop,
      distrito: (Array.isArray(distritos) ? distritos[0] : distritos)?.nombre ?? null,
    }));
    return NextResponse.json({ desde: from || null, hasta: to || null, ...buildAdminReport({ orders, shops, users }) });
  } catch (error) {
    const cause = error as { code?: string; message?: string };
    const permission = isPermissionError(cause);
    console.error('Error generando el reporte de administración:', cause?.message);
    return NextResponse.json(
      { error: permission ? 'La política RLS no permite generar este reporte.' : 'No se pudo generar el reporte.' },
      { status: permission ? 403 : 502 },
    );
  }
}
