import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROLE_COOKIE, getAccountProfile, getVerifiedUser, roleCookieOptions } from '@/lib/server-auth';
import { cookies } from 'next/headers';

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const user = await getVerifiedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  }

  const cookieStore = cookies();
  const profile = await getAccountProfile(supabase, user.id, cookieStore.get(ROLE_COOKIE)?.value, (value) => {
    try { cookieStore.set(ROLE_COOKIE, value, roleCookieOptions); } catch { /* contexto de solo lectura */ }
  });

  if (profile && ['admin', 'administrador'].includes(profile.rol) && user.aal !== 'aal2') {
    return NextResponse.json({ error: 'Se requiere la verificación en dos pasos (código TOTP) para administrar.' }, { status: 403 });
  }

  if (!profile || profile.activo !== true || !['admin', 'administrador'].includes(profile.rol)) {
    return NextResponse.json({ error: 'No tienes permisos de administrador.' }, { status: 403 });
  }

  return { supabase, user };
}

export function isDeniedResponse(value: Awaited<ReturnType<typeof requireAdmin>>): value is NextResponse<{ error: string }> {
  return value instanceof NextResponse;
}

export function isPermissionError(error: { code?: string; message?: string }) {
  return error.code === '42501' || /row level security|permission denied|insufficient privilege/i.test(error.message || '');
}