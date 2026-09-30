import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let session: { access_token?: string; refresh_token?: string };

  try {
    session = await request.json();
  } catch {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 400 });
  }

  if (!session.access_token || !session.refresh_token) {
    return NextResponse.json({ error: 'Sesión no válida.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) return NextResponse.json({ error: 'No se pudo validar la sesión.' }, { status: 401 });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) return NextResponse.json({ error: 'No se pudo cerrar la sesión.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}