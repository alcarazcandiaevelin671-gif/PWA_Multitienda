import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROLE_COOKIE, getAccountProfile, getVerifiedUser } from '@/lib/server-auth';
import { cookies } from 'next/headers';

export async function requireMerchantPageAccess() {
  try {
    const supabase = await createSupabaseServerClient();
    const user = await getVerifiedUser(supabase);
    if (!user) return null;

    // El middleware ya dejó la cookie de rol firmada: normalmente no hace falta consultar la base.
    const profile = await getAccountProfile(supabase, user.id, cookies().get(ROLE_COOKIE)?.value);
    if (profile?.activo !== true || profile.rol !== 'comerciante') return null;

    return user;
  } catch {
    return null;
  }
}
