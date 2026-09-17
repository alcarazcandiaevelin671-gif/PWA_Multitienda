'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function Navbar() {
  const router = useRouter();
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [nombreMostrar, setNombreMostrar] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<any>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const consultarDatosUsuario = async (userSession: any) => {
      if (!userSession) {
        setUsuario(null);
        setRolUsuario(null);
        setNombreMostrar(null);
        return;
      }

      setUsuario(userSession);

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol, nombre_completo')
        .eq('id', userSession.id)
        .maybeSingle();

      if (perfil) {
        setRolUsuario(perfil.rol);

        if (perfil.rol === 'comerciante' || perfil.rol === 'vendedor') {
          const { data: tienda } = await supabase
            .from('tiendas')
            .select('nombre_comercio')
            .eq('usuario_id', userSession.id)
            .maybeSingle();

          if (tienda?.nombre_comercio) {
            setNombreMostrar(tienda.nombre_comercio);
          } else {
            setNombreMostrar(perfil.nombre_completo || userSession.email);
          }
        } else {
          setNombreMostrar(perfil.nombre_completo || userSession.email);
        }
      }
    };

    // Obtener sesión inicial
    supabase.auth.getUser().then(({ data: { user } }) => {
      consultarDatosUsuario(user);
    });

    // Escuchar cambios de estado en tiempo real (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      consultarDatosUsuario(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    setUsuario(null);
    setRolUsuario(null);
    setNombreMostrar(null);
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-slate-100 py-3 px-6 flex items-center justify-between sticky top-0 z-50">
      <Link href="/" className="font-bold text-slate-900 text-lg flex items-center gap-2">
        <span>Portal Guairá</span>
      </Link>

      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
        <Link href="/" className="hover:text-blue-600 transition-colors">
          Inicio
        </Link>
        <Link href="/tiendas" className="hover:text-blue-600 transition-colors">
          Tiendas
        </Link>
        <Link href="/categorias" className="hover:text-blue-600 transition-colors">
          Categorías
        </Link>
        <Link href="/vendedor/tienda" className="hover:text-blue-600 transition-colors">
          Registrar Mi Tienda
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        {rolUsuario === 'admin' && (
          <Link
            href="/admin"
            className="bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold text-xs px-3 py-1.5 rounded-lg border border-purple-200 transition-colors flex items-center gap-1"
          >
            <span>👑</span> Panel Administrador
          </Link>
        )}

        {(rolUsuario === 'comerciante' || rolUsuario === 'vendedor') && (
          <>
            <Link
              href="/vendedor/tienda"
              className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1"
            >
              <span>🏪</span> Mi Tienda
            </Link>

            <Link
              href="/vendedor/productos"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1"
            >
              <span>📦</span> Cargar Productos
            </Link>
          </>
        )}

        {usuario ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-700 font-semibold hidden sm:inline">
              {nombreMostrar || usuario.email}
            </span>
            <button
              onClick={handleCerrarSesion}
              className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100 transition-colors cursor-pointer"
            >
              Salir
            </button>
          </div>
        ) : (
          <Link
            href="/vendedor/tienda"
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            Iniciar Sesión
          </Link>
        )}
      </div>
    </header>
  );
}