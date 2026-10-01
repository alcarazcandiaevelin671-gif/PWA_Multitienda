import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function requireActiveSettingsUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('activo')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || profile?.activo !== true) {
    return { response: NextResponse.json({ error: 'La cuenta no está activa o no tiene un perfil disponible.' }, { status: 403 }) };
  }

  return { supabase, user };
}