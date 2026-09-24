'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PerfilCliente from '@/components/client/PerfilCliente';

export default function PerfilRolGate() {
  const [rol, setRol] = useState<'cliente' | 'vendedor' | 'administrador' | 'loading'>('loading');

  useEffect(() => {
    const cargarRol = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setRol('cliente');
          return;
        }

        const { data: usuario } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('identificacion', user.id)
          .maybeSingle();

        const rolDetectado = usuario?.rol || user.user_metadata?.rol || localStorage.getItem('rol_usuario') || 'cliente';
        const rolNormalizado = String(rolDetectado).toLowerCase();

        if (typeof window !== 'undefined') {
          localStorage.setItem('rol_usuario', rolNormalizado);
        }

        if (rolNormalizado === 'vendedor') {
          setRol('vendedor');
          return;
        }

        if (rolNormalizado === 'administrador') {
          setRol('administrador');
          return;
        }

        setRol('cliente');
      } catch (error) {
        console.error('Error al detectar el rol del usuario:', error);
        setRol('cliente');
      }
    };

    void cargarRol();
  }, []);

  if (rol === 'loading') {
    return <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Cargando perfil...</div>;
  }

  if (rol === 'vendedor') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700">
              Vendedor
            </span>
            <Link href="/vendedor/dashboard" className="text-emerald-700 font-bold hover:underline">
              Ir al Dashboard de Tienda
            </Link>
          </div>
        </div>
        <PerfilCliente />
      </div>
    );
  }

  if (rol === 'administrador') {
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

  return <PerfilCliente />;
}
