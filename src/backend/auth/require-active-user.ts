/**
 * [BACKEND] Guardia para rutas API de configuración: exige sesión válida y cuenta activa. Devuelve { supabase, user } o { response } con el error.
 */
import 'server-only';
import { createSupabaseServerClient } from '@/backend/supabase/server-client';
import { ROLE_COOKIE, getAccountProfile, getVerifiedUser, roleCookieOptions } from '@/backend/auth/server-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function requireActiveSettingsUser() {
  const supabase = await createSupabaseServerClient();
  const user = await getVerifiedUser(supabase);
  if (!user) {
    return { response: NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 }) };
  }

  const cookieStore = await cookies();
  const profile = await getAccountProfile(supabase, user.id, cookieStore.get(ROLE_COOKIE)?.value, (value) => {
    try { cookieStore.set(ROLE_COOKIE, value, roleCookieOptions); } catch { /* contexto de solo lectura */ }
  });
  if (profile?.activo !== true) {
    return { response: NextResponse.json({ error: 'La cuenta no está activa o no tiene un perfil disponible.' }, { status: 403 }) };
  }

  return { supabase, user };
}
