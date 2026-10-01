'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { deleteProfileAvatar, updateSettingsIdentity, uploadProfileAvatar } from '@/services/settings.service';

type PerfilUsuario = {
  nombre_completo: string;
  email: string;
  telefono_contacto: string;
  rol: string;
  activo: boolean;
};

type TiendaData = {
  id?: string;
  usuario_id?: string;
  nombre_comercio?: string | null;
  slug?: string | null;
  descripcion?: string | null;
  categoria_principal?: string | null;
  distrito_id?: number | null;
  distrito_nombre?: string | null;
  direccion_texto?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  estado?: string | null;
};

const normalizarRol = (valor: unknown): string => {
  const rol = String(valor ?? 'cliente').trim().toLowerCase();

  if (['admin', 'administrador'].includes(rol)) return 'admin';
  if (rol === 'comerciante') return 'comerciante';

  return 'cliente';
};

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [userSession, setUserSession] = useState<any>(null);
  const [userData, setUserData] = useState<PerfilUsuario | null>(null);
  const [tiendaData, setTiendaData] = useState<TiendaData | null>(null);
  const [tiendasData, setTiendasData] = useState<TiendaData[]>([]);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;

    const verificarYSincronizarUsuario = async () => {
      try {
        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        let currentUser: any = session?.user ?? undefined;

        if (!currentUser) {
          const { data: authUser } = await supabase.auth.getUser();
          currentUser = authUser?.user ?? undefined;
        }

        if (!currentUser) {
          if (isMounted) {
            setUserSession(null);
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setUserSession(currentUser);
        }

        const { data: dbUser } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (isMounted) {
          const rolFinal = dbUser?.rol || currentUser.user_metadata?.rol || 'cliente';
          const rolNormalizado = normalizarRol(rolFinal);

          setUserData({
            nombre_completo:
              dbUser?.nombre_completo ||
              currentUser.user_metadata?.nombre_completo ||
              currentUser.email?.split('@')[0] ||
              'Usuario',
            email: dbUser?.email || currentUser.email || '',
            telefono_contacto:
              dbUser?.telefono_contacto ||
              currentUser.user_metadata?.telefono ||
              'Sin registrar',
            rol: rolNormalizado,
            activo: dbUser?.activo ?? true
          });

          if (rolNormalizado === 'comerciante') {
            const { data: dbTiendas, error: tiendasError } = await supabase
              .from('tiendas')
              .select('*')
              .eq('usuario_id', currentUser.id)
              .order('nombre_comercio');
            if (tiendasError) throw tiendasError;

            const districtIds = Array.from(new Set((dbTiendas ?? []).map((store) => store.distrito_id).filter((id): id is number => typeof id === 'number')));
            const { data: districts, error: districtsError } = districtIds.length
              ? await supabase.from('distritos').select('id, nombre').in('id', districtIds)
              : { data: [], error: null };
            if (districtsError) throw districtsError;
            const districtNames = new Map((districts ?? []).map((district) => [district.id, district.nombre]));
            const enrichedStores = (dbTiendas ?? []).map((store) => ({
              ...store,
              distrito_nombre: districtNames.get(store.distrito_id) ?? null,
            })) as TiendaData[];

            if (isMounted) {
              setTiendasData(enrichedStores);
              setTiendaData(enrichedStores[0] ?? null);
            }
          } else {
            if (isMounted) {
              setTiendasData([]);
              setTiendaData(null);
            }
          }
        }
      } catch (err) {
        console.error('Error al obtener datos del perfil:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verificarYSincronizarUsuario();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        verificarYSincronizarUsuario();
      } else if (_event === 'SIGNED_OUT') {
        if (isMounted) {
          setUserSession(null);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Cargando perfil...</p>
      </div>
    );
  }

  if (!userSession || !userData) {
    return (
      <div className="mx-auto max-w-3xl rounded-[28px] border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-blue-50 p-8 text-center shadow-[0_20px_60px_rgba(14,116,144,0.12)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl shadow-inner">👤</div>
        <h2 className="text-2xl font-black text-slate-900">Inicia sesión para ver tu perfil</h2>
        <p className="mt-3 text-sm text-slate-600">
          Accede a tu cuenta para gestionar tus compras, favoritos, historial y preferencias.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/auth/login" className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-700">
            Iniciar sesión
          </Link>
          <Link href="/auth/registro" className="rounded-xl border border-sky-200 bg-white px-5 py-3 text-sm font-bold text-sky-700 transition hover:bg-sky-50">
            Crear cuenta
          </Link>
        </div>
      </div>
    );
  }

  const rolEtiqueta =
    userData.rol === 'admin'
      ? 'Administrador'
      : userData.rol === 'comerciante'
        ? 'Comerciante'
        : 'Cliente';

  const iniciales = userData.nombre_completo
    .split(' ')
    .slice(0, 2)
    .map((segmento) => segmento.charAt(0).toUpperCase())
    .join('') || 'U';

  const esComerciante = normalizarRol(userData.rol) === 'comerciante';
  const estadoTienda = String(tiendaData?.estado || 'sin registrar').trim().toLowerCase();
  const tiendaAprobada = ['activa', 'activo'].includes(estadoTienda);
  const estadoTiendaEtiqueta: Record<string, string> = {
    pendiente: 'Pendiente de aprobación',
    activa: 'Activa',
    activo: 'Activo',
    rechazada: 'Rechazada',
    rechazado: 'Rechazado',
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setAvatarMessage('');
    setAvatarError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Elige una imagen JPG, PNG o WebP.');
      input.value = '';
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setAvatarError('La imagen debe pesar 5 MB o menos.');
      input.value = '';
      return;
    }

    setAvatarSaving(true);
    let uploadedUrl: string | null = null;
    try {
      uploadedUrl = await uploadProfileAvatar(file);
      try {
        await updateSettingsIdentity({ avatar_url: uploadedUrl });
      } catch (cause) {
        await deleteProfileAvatar(uploadedUrl).catch(() => undefined);
        throw cause;
      }

      const { data } = await supabase.auth.refreshSession();
      const updatedUser = data.user ?? {
        ...userSession,
        user_metadata: { ...userSession.user_metadata, avatar_url: uploadedUrl },
      };
      setUserSession(updatedUser);
      setAvatarMessage('Foto de perfil actualizada.');
    } catch (cause) {
      setAvatarError(cause instanceof Error ? cause.message : 'No se pudo actualizar la foto de perfil.');
    } finally {
      setAvatarSaving(false);
      input.value = '';
    }
  };

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="w-full space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
        <header className={`relative isolate overflow-hidden p-6 text-white sm:p-8 ${userData.rol === 'admin' ? 'border-b border-violet-200 bg-gradient-to-br from-violet-950 via-indigo-900 to-slate-900' : userData.rol === 'comerciante' ? 'border-b border-emerald-200 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900' : 'border-b border-sky-200 bg-gradient-to-br from-sky-950 via-blue-800 to-slate-900'}`}>
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <div className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 bg-white/10 text-2xl font-black shadow-lg ring-4 ring-white/10 sm:h-24 sm:w-24 ${userData.rol === 'admin' ? 'border-violet-200/60' : userData.rol === 'comerciante' ? 'border-emerald-200/60' : 'border-sky-200/60'}`}>
                {typeof userSession.user_metadata?.avatar_url === 'string' && userSession.user_metadata.avatar_url.trim() ? <Image src={userSession.user_metadata.avatar_url} alt="Foto de perfil" fill unoptimized className="object-cover" /> : <span className="relative z-0">{iniciales}</span>}
                <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-900 bg-emerald-400 shadow-sm" aria-label="Sesión activa" />
              </div>

              <div className="min-w-0">
                <p className={`text-[11px] font-bold uppercase tracking-[0.16em] ${userData.rol === 'admin' ? 'text-violet-200' : userData.rol === 'comerciante' ? 'text-emerald-200' : 'text-sky-200'}`}>Cuenta personal</p>
                <h1 className="mt-1 break-words text-2xl font-extrabold leading-tight sm:text-3xl">{userData.nombre_completo}</h1>
                <p className="mt-2 break-all text-sm text-white/80">{userData.email}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="sr-only" aria-label="Seleccionar foto de perfil" />
                  <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarSaving} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60">
                    {avatarSaving ? 'Subiendo foto...' : 'Cambiar foto'}
                  </button>
                  <span className="text-[11px] text-white/70">JPG, PNG o WebP · Máx. 5 MB</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${userData.rol === 'admin' ? 'border-violet-200/30 bg-violet-300/15 text-violet-100' : userData.rol === 'comerciante' ? 'border-emerald-200/30 bg-emerald-300/15 text-emerald-100' : 'border-sky-200/30 bg-sky-300/15 text-sky-100'}`}>
                {rolEtiqueta}
              </span>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${userData.activo ? 'bg-emerald-300/15 text-emerald-100 ring-1 ring-inset ring-emerald-200/30' : 'bg-rose-300/15 text-rose-100 ring-1 ring-inset ring-rose-200/30'}`}>
                <span className={`h-2 w-2 rounded-full ${userData.activo ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                {userData.activo ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          </div>
          <svg aria-hidden="true" viewBox="0 0 180 130" fill="none" className="pointer-events-none absolute -right-2 top-1/2 hidden h-32 w-44 -translate-y-1/2 text-white/10 sm:block">
            <path d="M18 112V52l38-24 38 24v60M42 112V77h28v35M99 112V42h25V25h25v87M111 59h8m-8 17h8m-8 17h8m22-51h8m-8 17h8m-8 17h8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 112h155" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </header>

        {avatarError && <p role="alert" className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 sm:mx-6">{avatarError}</p>}
        {avatarMessage && <p role="status" className="mx-4 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:mx-6">{avatarMessage}</p>}

        <div className="grid w-full grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-3">
          <article className="flex h-full w-full min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:bg-white">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-lg text-blue-800">👤</span>
            <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Nombre completo</p><p className="mt-1 break-words text-sm font-bold text-slate-900">{userData.nombre_completo}</p></div>
          </article>
          <article className="flex h-full w-full min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:bg-white">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-lg text-sky-800">✉</span>
            <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Correo electrónico</p><p className="mt-1 break-all text-sm font-bold text-slate-900">{userData.email}</p></div>
          </article>
          <article className="flex h-full w-full min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:bg-white">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg text-emerald-800">☎</span>
            <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Teléfono</p><p className="mt-1 break-words text-sm font-bold text-slate-900">{userData.telefono_contacto}</p></div>
          </article>
        </div>
      </section>

      {esComerciante && (
        <section className="w-full rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800"><span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-base text-emerald-900">⌂</span>Mi comercio</p>
              <h2 className="mt-2 break-words text-xl font-extrabold text-slate-900 sm:text-2xl">{tiendaData?.nombre_comercio || 'Comercio registrado'}</h2>
              <p className="mt-2 text-sm text-slate-600">{tiendaData?.descripcion || 'Solicitud de registro de comercio.'}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${estadoTienda === 'pendiente' ? 'border-amber-200 bg-amber-50 text-amber-800' : tiendaAprobada ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : estadoTienda === 'rechazada' || estadoTienda === 'rechazado' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {estadoTiendaEtiqueta[estadoTienda] || estadoTienda.replace(/[_-]/g, ' ')}
                </span>
                {tiendaData?.categoria_principal && <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">Rubro · {tiendaData.categoria_principal}</span>}
              </div>
              {!tiendaAprobada && (
                <p className={`mt-4 max-w-2xl rounded-xl border p-3 text-sm leading-relaxed ${estadoTienda === 'pendiente' ? 'border-amber-200 bg-amber-50/70 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                  {estadoTienda === 'pendiente'
                    ? 'Tu solicitud está en revisión. Las funciones de comerciante estarán disponibles cuando el comercio sea aprobado.'
                    : 'Las funciones de comerciante no están disponibles hasta que el comercio sea aprobado.'}
                </p>
              )}
            </div>

            <div className="grid gap-2 rounded-2xl border border-emerald-100 bg-white/80 p-4 text-sm text-slate-700 sm:min-w-64">
              {tiendaData?.distrito_nombre && <p><span className="font-semibold text-slate-500">Distrito</span><span className="mt-0.5 block font-bold text-slate-900">{tiendaData.distrito_nombre}</span></p>}
              {tiendaData?.direccion_texto && <p><span className="font-semibold text-slate-500">Dirección</span><span className="mt-0.5 block font-bold text-slate-900">{tiendaData.direccion_texto}</span></p>}
              {(tiendaData?.telefono || tiendaData?.whatsapp) && <p><span className="font-semibold text-slate-500">Contacto</span><span className="mt-0.5 block font-bold text-slate-900">{tiendaData.telefono || tiendaData.whatsapp}</span></p>}
              {tiendaData?.email && <p><span className="font-semibold text-slate-500">Correo comercial</span><span className="mt-0.5 block break-all font-bold text-slate-900">{tiendaData.email}</span></p>}
              {tiendaData?.slug && tiendaAprobada && <Link href={`/tienda/${tiendaData.slug}`} className="mt-1 font-bold text-emerald-800 hover:text-emerald-950 hover:underline">Ver comercio publicado ↗</Link>}
              {tiendaAprobada && (
                <Link href="/comerciante" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                  Ir al panel de mi comercio
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {esComerciante && tiendasData.length > 1 && (
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-800">Comercios asociados</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Tus tiendas <span className="text-slate-400">({tiendasData.length})</span></h2></div><Link href="/comerciante/tiendas" className="text-sm font-bold text-emerald-800 hover:underline">Ver información completa →</Link></div>
          <ul className="mt-4 divide-y divide-slate-100">{tiendasData.map((store) => <li key={store.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words font-bold text-slate-900">{store.nombre_comercio}</p><p className="mt-1 text-sm text-slate-500">{store.distrito_nombre || 'Distrito no especificado'} · {String(store.estado || 'Sin estado').replaceAll('_', ' ')}</p></div>{store.slug && ['activa', 'activo'].includes(String(store.estado || '').toLowerCase()) && <Link href={`/tienda/${store.slug}`} className="rounded-lg px-3 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50">Ver tienda ↗</Link>}</li>)}</ul>
        </section>
      )}

      <section aria-label="Accesos rápidos" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/configuracion"
          className="group flex h-full w-full min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-800 transition group-hover:bg-blue-100">⚙</span>
          <span><span className="block text-xs font-semibold text-slate-500">Cuenta</span><span className="mt-1 block text-sm font-extrabold text-slate-900">Configurar mi cuenta</span></span>
        </Link>

        {userData.rol !== 'admin' && (
          <>
            <Link
              href="/favoritos"
              className="group flex h-full w-full min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
            >
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-xl text-rose-700 transition group-hover:bg-rose-100">♡</span>
              <span><span className="block text-xs font-semibold text-slate-500">Acceso rápido</span><span className="mt-1 block text-sm font-extrabold text-slate-900">Mis Favoritos</span></span>
            </Link>

            <Link
              href="/pedidos"
              className="group flex h-full w-full min-h-28 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-800 transition group-hover:bg-emerald-100">▤</span>
              <span><span className="block text-xs font-semibold text-slate-500">Historial</span><span className="mt-1 block text-sm font-extrabold text-slate-900">Mis Pedidos</span></span>
            </Link>
          </>
        )}

        <button
          type="button"
          onClick={handleCerrarSesion}
          className="group flex h-full w-full min-h-28 items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
        >
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-rose-700 transition group-hover:bg-rose-100">⇥</span>
          <span><span className="block text-xs font-semibold text-rose-700">Cuenta</span><span className="mt-1 block text-sm font-extrabold text-rose-800">Cerrar sesión</span></span>
        </button>
      </section>
    </div>
  );
}
