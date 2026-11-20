import { requireActiveSettingsUser } from '@/lib/settings-server';
import { NextResponse } from 'next/server';

const editableFields = ['nombre_completo', 'telefono_contacto', 'avatar_url'] as const;

export async function PATCH(request: Request) {
  const account = await requireActiveSettingsUser();
  if ('response' in account) return account.response;
  const { supabase, user } = account;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'La solicitud no tiene un formato válido.' }, { status: 400 });
  }

  const update: Record<string, string | null> = {};
  for (const field of editableFields) {
    const value = body[field];
    if (value === undefined) continue;
    if (value !== null && typeof value !== 'string') {
      return NextResponse.json({ error: 'Uno de los datos enviados no es válido.' }, { status: 400 });
    }
    update[field] = value as string | null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No hay cambios para guardar.' }, { status: 400 });
  }
  if (Object.prototype.hasOwnProperty.call(update, 'nombre_completo') && typeof update.nombre_completo !== 'string') {
    return NextResponse.json({ error: 'El nombre completo no es válido.' }, { status: 400 });
  }
  if (typeof update.nombre_completo === 'string' && (update.nombre_completo.trim().length < 2 || update.nombre_completo.trim().length > 100)) {
    return NextResponse.json({ error: 'El nombre debe tener entre 2 y 100 caracteres.' }, { status: 400 });
  }
  if (typeof update.nombre_completo === 'string') update.nombre_completo = update.nombre_completo.trim();
  if (typeof update.telefono_contacto === 'string' && update.telefono_contacto.length > 40) {
    return NextResponse.json({ error: 'El teléfono no puede superar los 40 caracteres.' }, { status: 400 });
  }
  if (typeof update.telefono_contacto === 'string' && update.telefono_contacto.trim() && !/^[+\d\s().-]{6,40}$/.test(update.telefono_contacto)) {
    return NextResponse.json({ error: 'El formato del teléfono no es válido.' }, { status: 400 });
  }
  const profileUpdate = { ...update };
  delete profileUpdate.avatar_url;
  if (Object.keys(profileUpdate).length) {
    const { error } = await supabase.from('usuarios').update(profileUpdate).eq('id', user.id);
    if (error) {
      return NextResponse.json({ error: 'No se pudieron guardar los datos. Verifica las políticas de acceso del perfil.' }, { status: 403 });
    }
  }

  if (typeof update.avatar_url === 'string') {
    try {
      const avatar = new URL(update.avatar_url);
      const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
      if (avatar.origin !== supabaseOrigin || !avatar.pathname.startsWith(`/storage/v1/object/public/avatars/${user.id}/`)) throw new Error();
    } catch {
      return NextResponse.json({ error: 'La referencia de la foto no pertenece a esta cuenta.' }, { status: 400 });
    }
  }
  if (Object.prototype.hasOwnProperty.call(update, 'avatar_url')) {
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: update.avatar_url } });
    if (error) return NextResponse.json({ error: 'No se pudo actualizar la foto del perfil en Supabase Auth.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}