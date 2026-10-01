import { NextResponse, type NextRequest } from 'next/server';
import { isDeniedResponse, requireAdmin } from '@/lib/admin-server';

export async function GET(_request: NextRequest) {
  const access = await requireAdmin();
  if (isDeniedResponse(access)) return access;
  return NextResponse.json({ error: 'El detalle transaccional ya no está disponible en el panel de administración.' }, { status: 410 });
}