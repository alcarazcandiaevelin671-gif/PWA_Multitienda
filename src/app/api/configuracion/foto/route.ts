import { requireActiveSettingsUser } from '@/lib/settings-server';
import { NextResponse } from 'next/server';

const imageTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const maxImageSize = 5 * 1024 * 1024;

function getOwnedAvatarPath(url: string, userId: string) {
  const parsed = new URL(url);
  const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  const marker = '/storage/v1/object/public/avatars/';
  const markerIndex = parsed.pathname.indexOf(marker);
  if (parsed.origin !== supabaseOrigin || markerIndex !== 0) return null;
  const path = decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  return path.startsWith(`${userId}/`) ? path : null;
}

export async function POST(request: Request) {
  const account = await requireActiveSettingsUser();
  if ('response' in account) return account.response;
  const { supabase, user } = account;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'El archivo enviado no es válido.' }, { status: 400 });
  }
  const file = form.get('file');
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Selecciona una imagen.' }, { status: 400 });
  const extension = imageTypes[file.type];
  if (!extension) return NextResponse.json({ error: 'Usa una imagen JPG, PNG o WebP.' }, { status: 400 });
  if (file.size === 0 || file.size > maxImageSize) return NextResponse.json({ error: 'La imagen debe pesar entre 1 byte y 5 MB.' }, { status: 400 });

  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hasSignature = file.type === 'image/jpeg'
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.type === 'image/png'
      ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      : bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!hasSignature) return NextResponse.json({ error: 'El contenido del archivo no coincide con una imagen permitida.' }, { status: 400 });
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: 'No se pudo guardar la imagen. Verifica el bucket y sus políticas de Storage.' }, { status: 403 });

  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ url });
}

export async function DELETE(request: Request) {
  const account = await requireActiveSettingsUser();
  if ('response' in account) return account.response;
  const { supabase, user } = account;

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'La solicitud no tiene un formato válido.' }, { status: 400 });
  }
  if (typeof body.url !== 'string') return NextResponse.json({ error: 'La referencia de la foto no es válida.' }, { status: 400 });

  let path: string | null;
  try {
    path = getOwnedAvatarPath(body.url, user.id);
  } catch {
    path = null;
  }
  if (!path) return NextResponse.json({ error: 'La foto no pertenece a esta cuenta.' }, { status: 403 });

  const { error } = await supabase.storage.from('avatars').remove([path]);
  if (error) return NextResponse.json({ error: 'No se pudo eliminar la imagen del bucket.' }, { status: 403 });
  return NextResponse.json({ ok: true });
}