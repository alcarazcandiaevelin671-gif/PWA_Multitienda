'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

export default function Navbar() {
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [nombreMostrar, setNombreMostrar] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<any>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const consultarDatosUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuario(user);

        // 1. Consultar rol y nombre en la tabla usuarios
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('rol, nombre')
          .eq('id', user.id)
          .maybeSingle();

        if (perfil) {
          setRolUsuario(perfil.rol);

          if (perfil.rol === 'comerciante' || perfil.rol === 'vendedor') {
            // 2. Si es comerciante/vendedor, buscamos el nombre de su tienda
            const { data: tienda } = await supabase
              .from('tiendas') // o 'comercios' según el nombre exacto de tu tabla
              .select('nombre')
              .eq('usuario_id', user.id)
              .maybeSingle();

            if (tienda?.nombre) {
              setNombreMostrar(tienda.nombre);
            } else {
              setNombreMostrar(perfil.nombre || user.email);
            }
          } else {
            // Si es cliente o admin
            setNombreMostrar(perfil.nombre || user.email);
          }
        }
      }
    };

    consultarDatosUsuario();
  }, [supabase]);

  const handleCerrarSesion = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <header className="bg-white border-b border-slate-100 py-3 px-6 flex items-center justify-between sticky top-0 z-50">
      {/* Logotipo */}
      <Link href="/" className="font-bold text-slate-900 text-lg flex items-center gap-2">
        <span>Portal Guairá</span>
      </Link>

      {/* Menú de Navegación Principal */}
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

      {/* Zona de Usuario / Acceso */}
      <div className="flex items-center gap-3">
        {/* Insignia para Administradores */}
        {rolUsuario === 'admin' && (
          <Link
            href="/admin"
            className="bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold text-xs px-3 py-1.5 rounded-lg border border-purple-200 transition-colors flex items-center gap-1"
          >
            <span>👑</span> Panel Administrador
          </Link>
        )}

        {/* Insignia o enlace rápido para Comerciantes / Vendedores */}
        {(rolUsuario === 'comerciante' || rolUsuario === 'vendedor') && (
          <Link
            href="/vendedor/tienda"
            className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-bold text-xs px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors flex items-center gap-1"
          >
            <span>🏪</span> Mi Tienda
          </Link>
        )}

        {/* Sesión Activa o Iniciar Sesión */}
        {usuario ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-700 font-semibold hidden sm:inline">
              {nombreMostrar || usuario.email}
            </span>
            <button
              onClick={handleCerrarSesion}
              className="text-xs font-semibold text-red-600 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100 transition-colors"
            >
              Salir
            </button>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            Iniciar Sesión
          </Link>
        )}
      </div>
    </header>
  );
}