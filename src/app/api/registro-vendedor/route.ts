import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { userFacingError } from '@/lib/user-facing-error';

type RegistroComerciante = {
  nombreCompleto: string;
  email: string;
  telefono: string;
  password: string;
  nombreComercio: string;
  descripcion: string;
  categoriaPrincipal: string;
  distritoId: number;
  direccion: string;
  telefonoComercial: string;
  latitud: number;
  longitud: number;
};

function isRegistroComerciante(value: unknown): value is RegistroComerciante {
  if (!value || typeof value !== 'object') return false;
  const input = value as Partial<RegistroComerciante>;
  const digits = (phone: unknown) => String(phone ?? '').replace(/\D/g, '').length;

  return (
    typeof input.nombreCompleto === 'string' && input.nombreCompleto.trim().length >= 3 && input.nombreCompleto.length <= 120
    && typeof input.email === 'string' && input.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
    && typeof input.telefono === 'string' && digits(input.telefono) >= 7 && digits(input.telefono) <= 15
    && typeof input.password === 'string' && input.password.length >= 10 && /[a-z]/.test(input.password) && /[A-Z]/.test(input.password) && /\d/.test(input.password)
    && typeof input.nombreComercio === 'string' && input.nombreComercio.trim().length >= 2 && input.nombreComercio.length <= 120
    && typeof input.descripcion === 'string' && input.descripcion.length <= 1500
    && typeof input.categoriaPrincipal === 'string' && input.categoriaPrincipal.length <= 100
    && Number.isInteger(input.distritoId) && Number(input.distritoId) > 0
    && typeof input.direccion === 'string' && input.direccion.length <= 250
    && typeof input.telefonoComercial === 'string' && digits(input.telefonoComercial) >= 7 && digits(input.telefonoComercial) <= 15
    && typeof input.latitud === 'number' && Number.isFinite(input.latitud) && input.latitud >= -90 && input.latitud <= 90
    && typeof input.longitud === 'number' && Number.isFinite(input.longitud) && input.longitud >= -180 && input.longitud <= 180
  );
}

function crearSlug(nombre: string, sufijo: string) {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return `${base || 'comercio'}-${sufijo}`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'La solicitud no contiene datos válidos.' }, { status: 400 });
  }

  if (!isRegistroComerciante(body)) {
    return NextResponse.json({ error: 'Revisa los datos obligatorios del usuario y del comercio.' }, { status: 422 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'El registro de comerciantes aún no está configurado en el servidor. Falta SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 503 }
    );
  }
  if (/^(tu-clave|your-|placeholder|\[)/i.test(serviceRoleKey.trim())) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY todavía contiene el valor de ejemplo. Reemplázalo por la clave service_role de este proyecto en .env.local y reinicia Next.js.' },
      { status: 503 }
    );
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = body.email.trim().toLowerCase();
  const nombreCompleto = body.nombreCompleto.trim();
  const telefono = body.telefono.trim();
  const nombreComercio = body.nombreComercio.trim();
  const emailRedirectTo = new URL('/auth/callback', request.url);
  emailRedirectTo.searchParams.set('next', '/auth/login?registro=comerciante');

  const { data: district, error: districtError } = await adminClient
    .from('distritos')
    .select('id')
    .eq('id', body.distritoId)
    .eq('activo', true)
    .maybeSingle();

  if (districtError) {
    console.error('No se pudo validar el distrito del comerciante:', districtError.message);
    if (/invalid api key/i.test(districtError.message)) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY no es válida para este proyecto. Copia la clave service_role correcta desde Supabase y reinicia Next.js.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'No se pudo validar el distrito seleccionado.' }, { status: 503 });
  }
  if (!district) {
    return NextResponse.json({ error: 'Selecciona un distrito activo del Guairá.' }, { status: 422 });
  }

  let categoriaPrincipal: string | null = null;
  if (body.categoriaPrincipal) {
    const { data: category, error: categoryError } = await adminClient
      .from('categorias')
      .select('nombre')
      .eq('activo', true)
      .eq('nombre', body.categoriaPrincipal)
      .maybeSingle();

    if (categoryError) {
      console.error('No se pudo validar la categoría del comerciante:', categoryError.message);
      return NextResponse.json({ error: 'No se pudo validar el rubro seleccionado.' }, { status: 503 });
    }
    if (!category) {
      return NextResponse.json({ error: 'Selecciona un rubro disponible.' }, { status: 422 });
    }
    categoriaPrincipal = category.nombre;
  }

  const { data: authData, error: authError } = await authClient.auth.signUp({
    email,
    password: body.password,
    options: {
      emailRedirectTo: emailRedirectTo.toString(),
      data: {
        nombre_completo: nombreCompleto,
        telefono_contacto: telefono,
      },
    },
  });

  if (authError) {
    return NextResponse.json({ error: userFacingError(authError, 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.') }, { status: 422 });
  }

  const authUser = authData.user;
  if (!authUser?.id || authUser.identities?.length === 0) {
    return NextResponse.json({ error: 'Ya existe una cuenta con ese correo o no se pudo crear.' }, { status: 409 });
  }

  const rollbackRegistration = async () => {
    const { error: storeCleanupError } = await adminClient.from('tiendas').delete().eq('usuario_id', authUser.id);
    const { error: userCleanupError } = await adminClient.from('usuarios').delete().eq('id', authUser.id);
    const { error: authCleanupError } = await adminClient.auth.admin.deleteUser(authUser.id);

    if (storeCleanupError || userCleanupError || authCleanupError) {
      console.error('No se pudo revertir completamente el registro parcial del comerciante.', {
        store: storeCleanupError?.message,
        user: userCleanupError?.message,
        auth: authCleanupError?.message,
      });
    }
  };

  const { error: userError } = await adminClient.from('usuarios').upsert(
    {
      id: authUser.id,
      email,
      nombre_completo: nombreCompleto,
      telefono_contacto: telefono,
      rol: 'comerciante',
      activo: true,
    },
    { onConflict: 'id' }
  );

  if (userError) {
    console.error('No se pudo guardar el perfil del comerciante:', userError.message);
    await rollbackRegistration();
    return NextResponse.json({ error: 'No se pudo guardar el perfil. No se completó el registro.' }, { status: 500 });
  }

  const { error: storeError } = await adminClient.from('tiendas').upsert(
    {
      usuario_id: authUser.id,
      distrito_id: body.distritoId,
      nombre_comercio: nombreComercio,
      slug: crearSlug(nombreComercio, authUser.id.slice(0, 8)),
      descripcion: body.descripcion.trim() || null,
      categoria_principal: categoriaPrincipal,
      direccion_texto: body.direccion.trim() || null,
      latitud: body.latitud,
      longitud: body.longitud,
      whatsapp: body.telefonoComercial.trim(),
      telefono: body.telefonoComercial.trim(),
      email,
      estado: 'pendiente',
    },
    { onConflict: 'usuario_id' }
  );

  if (storeError) {
    console.error('No se pudo crear el comercio del comerciante:', storeError.message);
    await rollbackRegistration();
    return NextResponse.json({ error: 'No se pudo crear el comercio. No se completó el registro.' }, { status: 500 });
  }

  return NextResponse.json(
    { confirmationRequired: !authData.session, message: 'La solicitud de comerciante quedó registrada y pendiente de aprobación.' },
    { status: 201 }
  );
}