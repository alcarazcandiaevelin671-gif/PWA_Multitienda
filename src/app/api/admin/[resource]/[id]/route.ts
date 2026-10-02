import { NextResponse, type NextRequest } from 'next/server';
import { isDeniedResponse, isPermissionError, requireAdmin } from '@/lib/admin-server';

export async function GET(_request: NextRequest) {
  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;
  return NextResponse.json({ error: 'El detalle transaccional ya no está disponible en el panel de administración.' }, { status: 410 });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let nextStatus: string;
  try {
    const body = await request.json() as { estado?: unknown };
    if (body.estado !== 'activa' && body.estado !== 'suspendida') {
      return NextResponse.json({ error: 'El estado solicitado no es válido.' }, { status: 400 });
    }
    nextStatus = body.estado;
  } catch {
    return NextResponse.json({ error: 'La solicitud no es válida.' }, { status: 400 });
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
  if (shop.estado !== 'activa' && shop.estado !== 'suspendida') {
    return NextResponse.json({ error: 'Solo se pueden suspender o reactivar comercios activos.' }, { status: 409 });
  }
  if (shop.estado === nextStatus) {
    return NextResponse.json({ error: 'El comercio ya tiene ese estado.' }, { status: 409 });
  }

  const { data: updated, error: updateError } = await access.supabase
    .from('tiendas')
    .update({ estado: nextStatus })
    .eq('id', params.id)
    .eq('estado', shop.estado)
    .select('id, estado, nombre_comercio')
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: isPermissionError(updateError) ? 'La política RLS no autoriza cambiar el estado del comercio.' : 'No se pudo actualizar el comercio.' },
      { status: isPermissionError(updateError) ? 403 : 502 }
    );
  }
  if (!updated) return NextResponse.json({ error: 'El comercio cambió de estado; actualiza la lista.' }, { status: 409 });

  const { error: auditError } = await access.supabase.from('auditorias').insert({
    usuario_id: access.user.id,
    accion: 'cambio_estado_admin',
    tabla_afectada: 'tiendas',
    registro_id: params.id,
    datos_anteriores: { estado: shop.estado },
    datos_nuevos: { estado: nextStatus },
  });

  return NextResponse.json({
    shop: updated,
    auditWarning: auditError ? 'El estado se actualizó, pero RLS no permitió registrar la auditoría.' : null,
  });
}