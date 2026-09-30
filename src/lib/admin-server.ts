import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();
  const profile = data as unknown as { rol: string } | null;

  if (error || !profile || !['admin', 'administrador'].includes(profile.rol.toLowerCase())) {
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