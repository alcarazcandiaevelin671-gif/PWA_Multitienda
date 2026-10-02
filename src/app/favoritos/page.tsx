'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import FavoriteToggle from '@/components/common/FavoriteToggle';
import { supabase } from '@/lib/supabase';

type FavoriteRow = { id: string | null; tienda_id: string | null; producto_id: string | null };
type StoreRow = { id: string; slug: string | null; nombre_comercio: string | null; descripcion: string | null; logo_url: string | null; portada_url: string | null };
type ProductRow = { id: string; tienda_id: string; nombre: string | null; titulo: string | null; descripcion: string | null; precio_gs: number | null; imagen_url: string | null };
type FavoriteCard = { kind: 'tienda' | 'producto'; targetId: string; name: string; detail: string; image: string | null; price: number | null; href: string };

export default function FavoritosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadFavorites = async () => {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError) setError('No se pudo verificar la sesión.');
      setUserId(user?.id ?? null);
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: rows, error: favoriteError } = await supabase
        .from('favoritos')
        .select('id, tienda_id, producto_id')
        .eq('usuario_id', user.id);

      if (!active) return;
      if (favoriteError) {
        setError('No se pudieron cargar tus favoritos.');
        setLoading(false);
        return;
      }

      const favoriteRows = (rows ?? []) as FavoriteRow[];
      const storeIds = Array.from(new Set(favoriteRows.map((item) => item.tienda_id).filter((id): id is string => Boolean(id))));
      const productIds = Array.from(new Set(favoriteRows.map((item) => item.producto_id).filter((id): id is string => Boolean(id))));
      let stores: StoreRow[] = [];
      let products: ProductRow[] = [];

      if (storeIds.length) {
        const { data } = await supabase.from('tiendas').select('id, slug, nombre_comercio, descripcion, logo_url, portada_url').in('id', storeIds);
        stores = (data ?? []) as StoreRow[];
      }
      if (productIds.length) {
        const { data } = await supabase.from('productos').select('id, tienda_id, nombre, titulo, descripcion, precio_gs, imagen_url').in('id', productIds);
        products = (data ?? []) as ProductRow[];
      }

      const knownStoreIds = new Set(stores.map((store) => store.id));
      const relatedStoreIds = Array.from(new Set(products.map((product) => product.tienda_id).filter((id) => !knownStoreIds.has(id))));
      if (relatedStoreIds.length) {
        const { data } = await supabase.from('tiendas').select('id, slug, nombre_comercio, descripcion, logo_url, portada_url').in('id', relatedStoreIds);
        stores = [...stores, ...((data ?? []) as StoreRow[])];
      }

      if (!active) return;
      const storesById = new Map(stores.map((store) => [store.id, store]));
      const productsById = new Map(products.map((product) => [product.id, product]));
      const cards: FavoriteCard[] = [];

      for (const favorite of favoriteRows) {
        if (favorite.tienda_id) {
          const store = storesById.get(favorite.tienda_id);
          cards.push({
            kind: 'tienda',
            targetId: favorite.tienda_id,
            name: store?.nombre_comercio || 'Tienda no disponible',
            detail: store?.descripcion || 'Comercio local',
            image: store?.portada_url || store?.logo_url || null,
            price: null,
            href: store?.slug ? `/tienda/${encodeURIComponent(store.slug)}` : '/tiendas',
          });
        } else if (favorite.producto_id) {
          const product = productsById.get(favorite.producto_id);
          const store = product ? storesById.get(product.tienda_id) : undefined;
          cards.push({
            kind: 'producto',
            targetId: favorite.producto_id,
            name: product?.nombre || product?.titulo || 'Producto no disponible',
            detail: store?.nombre_comercio || product?.descripcion || 'Producto del catálogo',
            image: product?.imagen_url || null,
            price: product?.precio_gs == null ? null : Number(product.precio_gs),
            href: product && store?.slug ? `/tienda/${encodeURIComponent(store.slug)}#product-${product.id}` : '/tiendas',
          });
        }
      }

      setFavorites(cards);
      setLoading(false);
    };

    void loadFavorites();
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 border-b border-slate-200 pb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">Tu cuenta</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Mis favoritos</h1>
          <p className="mt-2 text-sm text-slate-600">Tiendas y productos que guardaste.</p>
        </header>

        {!userId && !loading && <div className="rounded-xl border border-slate-200 bg-white p-6 text-center"><p className="font-semibold text-slate-700">Inicia sesión para ver tus favoritos.</p><Link href="/auth/login" className="mt-4 inline-flex rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800">Iniciar sesión</Link></div>}
        {error && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
        {loading ? <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">Cargando favoritos…</p>
          : userId && favorites.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">Todavía no guardaste tiendas ni productos.</p>
            : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{favorites.map((favorite) => (
              <article key={`${favorite.kind}-${favorite.targetId}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {favorite.image ? <Image src={favorite.image} alt={favorite.name} fill unoptimized className="object-cover" /> : <div className="flex h-full items-center justify-center text-4xl text-slate-300">{favorite.kind === 'tienda' ? '⌂' : '□'}</div>}
                  <FavoriteToggle kind={favorite.kind} targetId={favorite.targetId} className="absolute right-3 top-3 z-10" onChange={(isFavorite) => { if (!isFavorite) setFavorites((current) => current.filter((item) => item.kind !== favorite.kind || item.targetId !== favorite.targetId)); }} />
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold text-slate-500">{favorite.kind === 'tienda' ? 'Tienda' : favorite.detail}</p>
                  <h2 className="mt-1 truncate text-base font-bold text-slate-900">{favorite.name}</h2>
                  {favorite.price !== null && <p className="mt-2 text-sm font-extrabold text-sky-700">{favorite.price.toLocaleString('es-PY')} Gs.</p>}
                  <Link href={favorite.href} className="mt-3 inline-flex text-xs font-bold text-sky-700 hover:text-sky-900">Ver {favorite.kind === 'tienda' ? 'tienda' : 'producto'} →</Link>
                </div>
              </article>
            ))}</div>}
      </div>
    </main>
  );
}