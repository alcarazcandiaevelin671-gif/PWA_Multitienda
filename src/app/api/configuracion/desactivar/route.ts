import { createClient } from '@supabase/supabase-js';
import { requireActiveSettingsUser } from '@/lib/settings-server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const account = await requireActiveSettingsUser();
  if ('response' in account) return account.response;
  const { supabase, user } = account;

  let body: { password?: unknown; confirmation?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'La solicitud no tiene un formato válido.' }, { status: 400 });
  }
  if (body.confirmation !== 'DESACTIVAR' || typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 128) {
    return NextResponse.json({ error: 'Confirma escribiendo DESACTIVAR e ingresa tu contraseña actual.' }, { status: 400 });
  }
  if (!user.email) return NextResponse.json({ error: 'No se puede reautenticar esta cuenta con contraseña.' }, { status: 400 });

  const reauthClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
  const { data: reauthenticated, error: reauthError } = await reauthClient.auth.signInWithPassword({ email: user.email, password: body.password });
  if (reauthError || reauthenticated.user?.id !== user.id) {
    return NextResponse.json({ error: 'No se pudo verificar tu identidad.' }, { status: 401 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('usuarios')
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq('id', user.id)
    .eq('activo', true)
    .select('id')
    .maybeSingle();
  if (updateError || !updated) {
    return NextResponse.json({ error: 'No se pudo desactivar la cuenta. Verifica tus permisos y vuelve a intentarlo.' }, { status: 403 });
  }

  const { error: auditError } = await supabase.from('auditorias').insert({
    usuario_id: user.id,
    accion: 'desactivacion_cuenta',
    tabla_afectada: 'usuarios',
    registro_id: user.id,
    datos_anteriores: { activo: true },
    datos_nuevos: { activo: false },
  });
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true, auditRecorded: !auditError });
}