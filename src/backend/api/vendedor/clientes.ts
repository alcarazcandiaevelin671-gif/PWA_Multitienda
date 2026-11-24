/**
 * [BACKEND · API] Comerciante: clientes que compraron en SUS tiendas (/api/vendedor/clientes).
 *
 * Ruta pública: src/app/api/vendedor/clientes/route.ts (solo reexporta este archivo).
 * Los pedidos se leen con la sesión del comerciante (la función solo devuelve los de sus tiendas). La clave de servidor
 * se usa únicamente para el NOMBRE de esos clientes; no se devuelven correo, teléfono ni direcciones (minimización).
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { requireMerchantPageAccess } from '@/backend/auth/require-merchant';
import { createAdminClient } from '@/backend/supabase/admin-client';
import { createSupabaseServerClient } from '@/backend/supabase/server-client';

type OrderRow = { usuario_id: string; estado: string; total: number | string | null; created_at: string; eliminado_en?: string | null };

export async function GET() {
  const user = await requireMerchantPageAccess();
  if (!user) return NextResponse.json({ error: 'Esta sección es solo para comerciantes activos.' }, { status: 403 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('obtener_pedidos_mis_tiendas');
  if (error) return NextResponse.json({ error: 'No se pudieron cargar los pedidos de tu tienda.' }, { status: 502 });

  const clients = new Map<string, { id: string; pedidos: number; cancelados: number; total: number; primera: string; ultima: string }>();
  for (const order of (data ?? []) as unknown as OrderRow[]) {
    if (order.eliminado_en) continue;
    const entry = clients.get(order.usuario_id)
      ?? { id: order.usuario_id, pedidos: 0, cancelados: 0, total: 0, primera: order.created_at, ultima: order.created_at };
    entry.pedidos += 1;
    if (order.estado === 'cancelado') entry.cancelados += 1;
    else entry.total += Number(order.total ?? 0) || 0;
    if (order.created_at < entry.primera) entry.primera = order.created_at;
    if (order.created_at > entry.ultima) entry.ultima = order.created_at;
    clients.set(order.usuario_id, entry);
  }

  const names = new Map<string, string>();
  const admin = createAdminClient();
  const ids = [...clients.keys()];
  if (admin) {
    for (let i = 0; i < ids.length; i += 100) {
      const { data: rows } = await admin.from('usuarios').select('id, nombre_completo').in('id', ids.slice(i, i + 100));
      for (const row of (rows ?? []) as Array<{ id: string; nombre_completo: string | null }>) {
        if (row.nombre_completo) names.set(row.id, row.nombre_completo);
      }
    }
  }

  const clientes = [...clients.values()]
    .sort((left, right) => right.ultima.localeCompare(left.ultima))
    .map(({ id, ...client }, index) => ({ clave: index + 1, nombre: names.get(id) ?? 'Cliente', ...client }));
  // `nombres` (identificador → nombre) lo usan Pedidos, Ventas y Facturas para mostrar al cliente por su nombre.
  return NextResponse.json({ clientes, nombres: Object.fromEntries(names) }, { headers: { 'Cache-Control': 'no-store' } });
}
