import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requireMerchantPageAccess() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    const role = String(profile?.rol ?? '').trim().toLowerCase();
    if (profileError || role !== 'comerciante') {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}