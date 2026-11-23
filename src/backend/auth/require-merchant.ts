/**
 * [BACKEND] Guardia para layouts del panel de comerciante: devuelve el usuario si es comerciante activo, o null.
 */
import 'server-only';
import { createSupabaseServerClient } from '@/backend/supabase/server-client';
import { ROLE_COOKIE, getAccountProfile, getVerifiedUser } from '@/backend/auth/server-auth';
import { cookies } from 'next/headers';

export async function requireMerchantPageAccess() {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getVerifiedUser(supabase);
    if (!user) return null;

    // El middleware ya dejó la cookie de rol firmada: normalmente no hace falta consultar la base.
    const profile = await getAccountProfile(supabase, user.id, (await cookies()).get(ROLE_COOKIE)?.value);
    if (profile?.activo !== true || profile.rol !== 'comerciante') return null;

    return user;
  } catch {
    return null;
  }
}
