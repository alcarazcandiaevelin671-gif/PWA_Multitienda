import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ROLE_COOKIE } from '@/lib/server-auth';

const isToken = (value: unknown, max: number) => typeof value === 'string' && value.length > 10 && value.length <= max;

export async function POST(request: Request) {
  let session: { access_token?: string; refresh_token?: string };

  try {
    session = await request.json();
  } catch {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 400 });
  }

  // Validación de entrada (ASVS V5): tipos y tamaños acotados antes de llamar a Supabase.
  if (!isToken(session?.access_token, 4096) || !isToken(session?.refresh_token, 512)) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token as string,
    refresh_token: session.refresh_token as string,
  });

  if (error) return NextResponse.json({ error: 'No se pudo validar la sesión.' }, { status: 401 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  cookies().delete(ROLE_COOKIE);

  if (error) return NextResponse.json({ error: 'No se pudo cerrar la sesión.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}