'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';

type ProductSearchResult = {
  id: string;
  tienda_id: string;
  titulo: string;
  descripcion?: string | null;
  precio_gs: number;
  categoria_id?: number | null;
};

const normalizeRole = (value: unknown): string => {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (['admin', 'administrador'].includes(normalized)) return 'admin';
  if (normalized === 'comerciante') return 'comerciante';
  return 'cliente';
};

export default function Navbar() {
  const router = useRouter();
  const { totalItems } = useCart();
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [nombreMostrar, setNombreMostrar] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let syncPromise: Promise<void> | null = null;
    let syncedAccessToken: string | null = null;

    const syncServerSession = async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== userId || session.access_token === syncedAccessToken) return;
      if (syncPromise) {
        await syncPromise;
        return;
      }

      const accessToken = session.access_token;
      syncPromise = (async () => {
        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });
        if (!response.ok) throw new Error('No se pudo sincronizar la sesión del servidor.');
        syncedAccessToken = accessToken;
      })();

      try {
        await syncPromise;
      } catch (error) {
        console.error('Error al sincronizar la sesión del servidor:', error);
      } finally {
        syncPromise = null;
      }
    };

    const consultarDatosUsuario = async (userSession: any) => {
      if (!userSession) {
        setUsuario(null);
        setRolUsuario(null);
        setNombreMostrar(null);
        return;
      }

      setUsuario(userSession);
      await syncServerSession(userSession.id);

      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol, nombre_completo')
        .eq('id', userSession.id)
        .maybeSingle();

      if (perfil) {
        const rolNormalizado = normalizeRole(perfil.rol);
        setRolUsuario(rolNormalizado);

        if (rolNormalizado === 'comerciante') {
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
      window.setTimeout(() => {
        void consultarDatosUsuario(session?.user ?? null);
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const normalized = searchTerm.trim();

    if (!normalized) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const [textMatch, categoryMatch] = await Promise.all([
          supabase
            .from('productos')
            .select('id, tienda_id, titulo, descripcion, precio_gs, categoria_id')
            .eq('disponible', true)
            .or(`titulo.ilike.%${normalized}%,descripcion.ilike.%${normalized}%`)
            .limit(8),
          supabase
            .from('categorias')
            .select('id')
            .ilike('nombre', `%${normalized}%`)
            .limit(20),
        ]);

        const categoryIds = (categoryMatch.data || []).map((category) => category.id);

        let categoryProducts: { data: ProductSearchResult[] | null } = { data: [] };

        if (categoryIds.length > 0) {
          const { data } = await supabase
            .from('productos')
            .select('id, tienda_id, titulo, descripcion, precio_gs, categoria_id')
            .eq('disponible', true)
            .in('categoria_id', categoryIds)
            .limit(8);

          categoryProducts = { data: data || [] };
        }

        const combined = [...(textMatch.data || []), ...(categoryProducts.data || [])];
        const uniqueResults = Array.from(new Map(combined.map((product) => [product.id, product])).values());
        setSearchResults(uniqueResults);
      } catch (error) {
        console.error('Error al filtrar productos:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSelectProduct = async (product: ProductSearchResult) => {
    try {
      const { data: tienda } = await supabase
        .from('tiendas')
        .select('slug')
        .eq('id', product.tienda_id)
        .maybeSingle();

      const slug = tienda?.slug;
      setSearchTerm('');
      setSearchResults([]);

      if (slug) {
        router.push(`/tienda/${slug}#product-${product.id}`);
        return;
      }

      router.push('/tiendas');
    } catch (error) {
      console.error('Error al redirigir al producto:', error);
      router.push('/tiendas');
    }
  };

  const handleCerrarSesion = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUsuario(null);
      setRolUsuario(null);
      setNombreMostrar(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('rol_usuario');
      }
      router.push('/');
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-slate-100 bg-white px-4 py-3 sm:px-6">
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
      </nav>

      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3">
        {usuario && rolUsuario === 'cliente' && (
          <>
            <Link href="/checkout" aria-label={`Carrito${totalItems ? `, ${totalItems} productos` : ''}`} className="text-xs font-bold text-slate-700 hover:text-blue-700">
              Carrito{totalItems > 0 ? ` (${totalItems})` : ''}
            </Link>
            <Link href="/pedidos" className="text-xs font-bold text-slate-700 hover:text-blue-700">Mis pedidos</Link>
          </>
        )}
        <div className="relative hidden md:block">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
            <span className="text-slate-400">🔎</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar productos o categorías"
              className="w-52 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none"
              aria-label="Buscar productos o categorías"
            />
          </div>

          {searchTerm.trim() && (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[22rem] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {isSearching ? (
                <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p>
              ) : searchResults.length > 0 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => void handleSelectProduct(product)}
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-slate-800">{product.titulo}</span>
                        <span className="text-[10px] font-bold text-emerald-600">Gs. {Number(product.precio_gs || 0).toLocaleString('es-PY')}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{product.descripcion || 'Producto disponible'}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-3 py-2 text-xs text-slate-500">No encontramos productos para “{searchTerm.trim()}”.</p>
              )}
            </div>
          )}
        </div>

        {rolUsuario === 'admin' && (
          <Link
            href="/admin"
            className="bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold text-xs px-3 py-1.5 rounded-lg border border-purple-200 transition-colors flex items-center gap-1"
          >
            <span>👑</span> Panel Administrador
          </Link>
        )}

        {rolUsuario === 'comerciante' && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100">Mi negocio <span aria-hidden="true">▾</span></summary>
            <nav aria-label="Panel del comerciante" className="absolute right-0 top-[calc(100%+0.5rem)] z-[70] grid min-w-48 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {[
                ['/vendedor', 'Dashboard'],
                ['/vendedor/tiendas', 'Mis tiendas'],
                ['/comerciante/productos', 'Productos'],
                ['/comerciante/pedidos', 'Pedidos'],
                ['/comerciante/ventas', 'Ventas'],
                ['/comerciante/facturas', 'Facturas'],
                ['/vendedor/reportes', 'Reportes'],
              ].map(([href, label]) => <Link key={href} href={href} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700">{label}</Link>)}
            </nav>
          </details>
        )}

        {usuario ? (
          <div className="flex items-center gap-2">
            <Link href="/configuracion" className="text-xs font-bold text-slate-700 hover:text-blue-700">Configuración</Link>
            <Link
              href="/perfil"
              aria-label="Ir a mi perfil"
              className="flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 p-1.5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-lg text-white shadow-sm ring-2 ring-white">
                👤
              </span>
            </Link>
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