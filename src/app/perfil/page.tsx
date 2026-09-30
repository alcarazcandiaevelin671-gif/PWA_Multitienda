'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
            const { data: dbTienda } = await supabase
              .from('tiendas')
              .select('*')
              .eq('usuario_id', currentUser.id)
              .maybeSingle();

            let distritoNombre: string | null = null;
            if (dbTienda?.distrito_id) {
              const { data: distrito } = await supabase
                .from('distritos')
                .select('nombre')
                .eq('id', dbTienda.distrito_id)
                .maybeSingle();
              distritoNombre = distrito?.nombre ?? null;
            }

            if (isMounted) {
              setTiendaData(dbTienda ? { ...dbTienda, distrito_nombre: distritoNombre } : null);
            }
          } else {
            if (isMounted) {
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

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[32px] border border-blue-100 bg-white shadow-[0_28px_80px_rgba(37,99,235,0.08)]">
        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 p-6 text-white md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-2xl font-black shadow-inner">
                {iniciales}
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-400 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-white" />
                </span>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-100">Sesión activa</p>
                <h1 className="mt-2 text-3xl font-black text-white md:text-4xl">{userData.nombre_completo}</h1>
                <p className="mt-1 text-sm text-blue-50">{userData.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                {rolEtiqueta}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] ${userData.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                {userData.activo ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Nombre completo</p>
            <p className="mt-3 text-lg font-bold text-slate-900">{userData.nombre_completo}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Correo electrónico</p>
            <p className="mt-3 text-lg font-bold text-slate-900 break-all">{userData.email}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Teléfono</p>
            <p className="mt-3 text-lg font-bold text-slate-900">{userData.telefono_contacto}</p>
          </div>
        </div>
      </div>

      {esComerciante && (
        <div className="rounded-[28px] border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Mi comercio</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{tiendaData?.nombre_comercio || 'Comercio registrado'}</h2>
              <p className="mt-2 text-sm text-slate-600">{tiendaData?.descripcion || 'Solicitud de registro de comercio.'}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-black uppercase text-blue-800">
                  {estadoTiendaEtiqueta[estadoTienda] || estadoTienda.replace(/[_-]/g, ' ')}
                </span>
                {tiendaData?.categoria_principal && <span className="text-sm text-slate-600">Rubro: {tiendaData.categoria_principal}</span>}
              </div>
              {!tiendaAprobada && (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {estadoTienda === 'pendiente'
                    ? 'Tu solicitud está en revisión. Las funciones de comerciante estarán disponibles cuando el comercio sea aprobado.'
                    : 'Las funciones de comerciante no están disponibles hasta que el comercio sea aprobado.'}
                </p>
              )}
            </div>

            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 md:min-w-64 md:grid-cols-1">
              {tiendaData?.distrito_nombre && <p><span className="font-bold">Distrito:</span> {tiendaData.distrito_nombre}</p>}
              {tiendaData?.direccion_texto && <p><span className="font-bold">Dirección:</span> {tiendaData.direccion_texto}</p>}
              {(tiendaData?.telefono || tiendaData?.whatsapp) && <p><span className="font-bold">Contacto:</span> {tiendaData.telefono || tiendaData.whatsapp}</p>}
              {tiendaData?.email && <p className="break-all"><span className="font-bold">Correo comercial:</span> {tiendaData.email}</p>}
              {tiendaData?.slug && tiendaAprobada && <Link href={`/tienda/${tiendaData.slug}`} className="font-bold text-blue-700 hover:underline">Ver comercio publicado</Link>}
              {tiendaAprobada && (
                <Link href="/comerciante/dashboard" className="mt-2 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700">
                  Ir al panel de mi comercio
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/favoritos"
          className="rounded-[22px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Acceso rápido</p>
          <p className="mt-3 text-lg font-black text-slate-900">Mis Favoritos</p>
        </Link>

        <Link
          href="/pedidos"
          className="rounded-[22px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Historial</p>
          <p className="mt-3 text-lg font-black text-slate-900">Mis Pedidos</p>
        </Link>

        <button
          type="button"
          onClick={handleCerrarSesion}
          className="rounded-[22px] border border-red-200 bg-red-50 p-5 text-left shadow-sm transition hover:bg-red-100"
        >
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">Cuenta</p>
          <p className="mt-3 text-lg font-black text-red-700">Cerrar Sesión</p>
        </button>
      </div>
    </div>
  );
}
