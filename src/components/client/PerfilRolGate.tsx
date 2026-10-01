'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PerfilCliente from '@/components/client/PerfilCliente';

const normalizeRole = (value: unknown): 'admin' | 'comerciante' | 'cliente' => {
  const normalized = String(value ?? 'cliente').trim().toLowerCase();

  if (['admin', 'administrador'].includes(normalized)) return 'admin';
  if (normalized === 'comerciante') return 'comerciante';
  return 'cliente';
};

export default function PerfilRolGate() {
  const [rol, setRol] = useState<'cliente' | 'comerciante' | 'admin' | 'loading'>('loading');

  useEffect(() => {
    const verificarSesion = async () => {
      setRol('loading');

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setRol('cliente');
        return;
      }

      const user = session.user;

      const { data: dbUser } = await supabase
        .from('usuarios')
        .select('nombre_completo, email, telefono_contacto, rol')
        .eq('id', user.id)
        .maybeSingle();

      if (dbUser) {
        const rolNormalizado = normalizeRole(dbUser.rol || user.user_metadata?.rol || 'cliente');

        if (typeof window !== 'undefined') {
          localStorage.setItem('rol_usuario', rolNormalizado);
        }

        if (rolNormalizado === 'comerciante') {
          setRol('comerciante');
          return;
        }

        if (rolNormalizado === 'admin') {
          setRol('admin');
          return;
        }

        setRol('cliente');
        return;
      }

      const rolNormalizado = normalizeRole(user.user_metadata?.rol || 'cliente');

      if (typeof window !== 'undefined') {
        localStorage.setItem('rol_usuario', rolNormalizado);
      }

      if (rolNormalizado === 'comerciante') {
        setRol('comerciante');
        return;
      }

      if (rolNormalizado === 'admin') {
        setRol('admin');
        return;
      }

      setRol('cliente');
    };

    verificarSesion();
  }, []);

  if (rol === 'loading') {
    return (
      <div className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
        <p className="mt-4 text-sm font-semibold text-slate-500">Cargando perfil...</p>
      </div>
    );
  }

  if (rol === 'comerciante') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
              Comerciante
            </span>
            <Link href="/comerciante" className="text-emerald-700 font-bold hover:underline">
              Ir al panel del comercio
            </Link>
          </div>
        </div>
        <PerfilCliente />
      </div>
    );
  }

  if (rol === 'admin') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-violet-300 bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-violet-700">
              Administrador
            </span>
            <Link href="/admin" className="text-violet-700 font-bold hover:underline">
              Acceder a la Consola
            </Link>
          </div>
        </div>
        <PerfilCliente />
      </div>
    );
  }

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
