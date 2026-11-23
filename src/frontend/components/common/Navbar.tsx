'use client';

/**
 * [FRONTEND] Barra superior: navegación, buscador, carrito, notificaciones, "Personalizar", accesos por rol y sincronización de sesión con el servidor.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/shared/supabase/client';
import { useCart } from '@/frontend/context/CartContext';
import NotificationBell from '@/frontend/components/common/NotificationBell';
import { openAppearancePanel } from '@/frontend/components/apariencia/AppearanceDrawer';

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
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname?.startsWith(href) ?? false);
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
      // La sincronización de cookies con el servidor no bloquea la carga del perfil.
      void syncServerSession(userSession.id);

      // Una sola consulta: perfil + nombre de la tienda (relación anidada), antes eran dos en serie.
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('rol, nombre_completo, tiendas(nombre_comercio)')
        .eq('id', userSession.id)
        .maybeSingle();

      if (perfil) {
        const rolNormalizado = normalizeRole(perfil.rol);
        setRolUsuario(rolNormalizado);
        const tiendas = perfil.tiendas as { nombre_comercio?: string | null } | Array<{ nombre_comercio?: string | null }> | null;
        const nombreTienda = Array.isArray(tiendas) ? tiendas[0]?.nombre_comercio : tiendas?.nombre_comercio;
        setNombreMostrar(
          (rolNormalizado === 'comerciante' && nombreTienda) || perfil.nombre_completo || userSession.email,
        );
      }
    };

    // onAuthStateChange emite INITIAL_SESSION al suscribirse, así que no hace falta un getUser()
    // aparte (duplicaba la sincronización de sesión y las consultas a usuarios/tiendas).
    // Solo se vuelve a consultar el perfil si cambia el usuario; TOKEN_REFRESHED solo resincroniza la sesión.
    // Inicio de sesión con Google (los tokens llegan en la URL y no pasan por el servidor):
    // un administrador, o quien activó MFA, debe pasar por la verificación en dos pasos.
    const exigirSegundoFactor = async (userId: string) => {
      if (window.location.pathname.startsWith('/auth/')) return;
      const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (nivel?.currentLevel === 'aal2') return;
      const { data: perfil } = await supabase.from('usuarios').select('rol').eq('id', userId).maybeSingle();
      const esAdmin = normalizeRole(perfil?.rol) === 'admin';
      if (esAdmin || nivel?.nextLevel === 'aal2') {
        const destino = esAdmin ? '/admin' : window.location.pathname + window.location.search;
        window.location.assign(`/auth/mfa?next=${encodeURIComponent(destino)}`);
      }
    };

    let lastUserId: string | null | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      window.setTimeout(() => {
        if (event === 'SIGNED_IN' && nextUserId) void exigirSegundoFactor(nextUserId);
        if (nextUserId === lastUserId) {
          if (nextUserId) void syncServerSession(nextUserId);
          return;
        }
        lastUserId = nextUserId;
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
      const confirmedSearch = searchTerm.trim().slice(0, 120);
      if (usuario?.id && rolUsuario === 'cliente' && confirmedSearch.length >= 2) {
        await supabase.rpc('registrar_historial_busqueda', {
          p_termino: confirmedSearch,
          p_categoria_id: product.categoria_id ?? null,
          p_distrito_id: null,
        });
        await supabase.rpc('registrar_interaccion_producto', {
          p_producto_id: product.id,
          p_tipo: 'click',
        });
      }

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
    <header className="sticky top-0 z-50 flex w-full flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-slate-200/80 border-t-2 border-t-accent-600 zone-header px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6 lg:px-8">
      <Link href="/" className="group flex shrink-0 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600">
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-primary-700 text-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
            <path d="M3 10.5 12 4l9 6.5V21h-6v-6H9v6H3V10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M7 11h2m6 0h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-base font-extrabold text-slate-900 transition group-hover:text-primary-800 sm:text-lg">Portal Guairá</span>
          <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:block">Comercio local</span>
        </span>
      </Link>

      <nav aria-label="Principal" className="header-pill hidden items-center gap-1 rounded-xl border p-1 text-sm font-semibold md:flex">
        <Link href="/" aria-current={isActive('/') ? 'page' : undefined} className="header-link rounded-lg px-3 py-2 transition-colors">
          Inicio
        </Link>
        <Link href="/tiendas" aria-current={isActive('/tiendas') ? 'page' : undefined} className="header-link rounded-lg px-3 py-2 transition-colors">
          Explorar Productos
        </Link>
        <Link href="/categorias" aria-current={isActive('/categorias') ? 'page' : undefined} className="header-link rounded-lg px-3 py-2 transition-colors">
          Categorías
        </Link>
      </nav>

      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        {usuario && rolUsuario === 'cliente' && (
          <>
            <Link href="/checkout" aria-label={`Carrito${totalItems ? `, ${totalItems} productos` : ''}`} className="text-xs font-bold text-slate-700 hover:text-primary-700">
              Carrito{totalItems > 0 ? ` (${totalItems})` : ''}
            </Link>
            <Link href="/pedidos" className="text-xs font-bold text-slate-700 hover:text-primary-700">Mis pedidos</Link>
          </>
        )}
        <div className="relative hidden md:block">
          <div className="header-pill header-search flex items-center gap-2 rounded-xl border px-3 py-2 transition focus-within:ring-2 focus-within:ring-primary-200">
            <span aria-hidden="true" className="header-muted">⌕</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar productos o categorías"
              className="header-input w-52 bg-transparent text-xs outline-none"
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
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left transition hover:border-primary-200 hover:bg-primary-50"
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

        <button
          type="button"
          onClick={openAppearancePanel}
          title="Personalizar colores y apariencia"
          className="flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-bold text-primary-800 transition hover:border-primary-300 hover:bg-primary-100"
        >
          <span aria-hidden="true">🎨</span>
          <span className="hidden sm:inline">Personalizar</span>
          <span className="sr-only sm:hidden">Personalizar</span>
        </button>

        {usuario?.id && rolUsuario && <NotificationBell userId={usuario.id} role={rolUsuario} />}

        {rolUsuario === 'admin' && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 transition hover:border-violet-300 hover:bg-violet-100"
          >
            <span>👑</span> Panel Administrador
          </Link>
        )}

        {rolUsuario === 'comerciante' && (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100">Mi negocio <span aria-hidden="true">▾</span></summary>
            <nav aria-label="Panel del comerciante" className="absolute right-0 top-[calc(100%+0.5rem)] z-[70] grid min-w-48 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {[
                ['/comerciante', 'Panel de comerciante'],
                ['/comerciante/tiendas', 'Mis tiendas'],
                ['/comerciante/productos', 'Productos'],
                ['/comerciante/pedidos', 'Pedidos'],
                ['/comerciante/ventas', 'Ventas'],
                ['/comerciante/facturas', 'Facturas'],
                ['/comerciante/reportes', 'Reportes'],
              ].map(([href, label]) => <Link key={href} href={href} onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-primary-50 hover:text-primary-700">{label}</Link>)}
            </nav>
          </details>
        )}

        {usuario ? (
          <div className="flex items-center gap-2">
            <Link
              href="/configuracion"
              aria-label="Configuración"
              title="Configuración"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-primary-50 hover:text-primary-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              <span aria-hidden="true" className="text-xl leading-none">⚙</span>
              <span className="sr-only">Configuración</span>
            </Link>
            <Link
              href="/perfil"
              aria-label="Ir a mi perfil"
              className="flex items-center justify-center rounded-full border border-slate-200 bg-white p-1 shadow-sm transition hover:border-primary-300 hover:shadow-md"
            >
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-700 to-emerald-600 text-lg text-white shadow-sm ring-2 ring-white">
                {typeof usuario.user_metadata?.avatar_url === 'string' && usuario.user_metadata.avatar_url.trim() ? (
                  <Image src={usuario.user_metadata.avatar_url} alt="" fill sizes="40px" unoptimized className="object-cover" />
                ) : (
                  <span aria-hidden="true">👤</span>
                )}
              </span>
            </Link>
          </div>
        ) : (
          <Link
            href="/auth/login"
            className="text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            Iniciar Sesión
          </Link>
        )}
      </div>
    </header>
  );
}