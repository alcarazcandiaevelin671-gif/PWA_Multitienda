import { NextResponse, type NextRequest } from 'next/server';
import { isDeniedResponse, isPermissionError, requireAdmin } from '@/lib/admin-server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  let observacion = '';
  try {
    const body = await request.json() as { observacion?: unknown };
    if (body.observacion != null && typeof body.observacion !== 'string') {
      return NextResponse.json({ error: 'La observación no es válida.' }, { status: 400 });
    }
    observacion = typeof body.observacion === 'string' ? body.observacion.trim() : '';
    if (observacion.length > 500) {
      return NextResponse.json({ error: 'La observación no puede superar los 500 caracteres.' }, { status: 400 });
    }
  } catch {
    observacion = '';
  }

  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;

  const { data: shop, error: readError } = await access.supabase
    .from('tiendas')
    .select('id, estado, nombre_comercio')
    .eq('id', params.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { error: isPermissionError(readError) ? 'La política RLS no permite revisar este comercio.' : 'No se pudo consultar el comercio.' },
      { status: isPermissionError(readError) ? 403 : 502 }
    );
  }
  if (!shop) return NextResponse.json({ error: 'No se encontró el comercio.' }, { status: 404 });
  if (shop.estado !== 'pendiente') return NextResponse.json({ error: 'Solo se pueden rechazar comercios pendientes.' }, { status: 409 });

  const { data: updated, error: updateError } = await access.supabase
    .from('tiendas')
    .update({ estado: 'rechazada' })
    .eq('id', params.id)
    .eq('estado', 'pendiente')
    .select('id, estado, nombre_comercio')
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: isPermissionError(updateError) ? 'La política RLS no autoriza rechazar comercios.' : 'No se pudo rechazar el comercio.' },
      { status: isPermissionError(updateError) ? 403 : 502 }
    );
  }
  if (!updated) return NextResponse.json({ error: 'El comercio cambió de estado; actualiza la lista.' }, { status: 409 });

  const { error: auditError } = await access.supabase.from('auditorias').insert({
    usuario_id: access.user.id,
    accion: 'rechazo_comercio',
    tabla_afectada: 'tiendas',
    registro_id: params.id,
    datos_anteriores: { estado: 'pendiente' },
    datos_nuevos: { estado: 'rechazada', observacion: observacion || null },
  });

  return NextResponse.json({
    shop: updated,
    auditLogged: !auditError,
    auditWarning: auditError ? 'El comercio fue rechazado, pero RLS no permitió registrar la auditoría.' : null,
  });
}