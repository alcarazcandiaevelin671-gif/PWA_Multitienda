'use client';

/**
 * [FRONTEND] Inicio: productos y comercios recomendados por el motor híbrido de IA
 * (contenido TF-IDF, filtrado colaborativo, popularidad y cercanía). Cada sugerencia muestra su motivo.
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getClientUser, supabase } from '@/shared/supabase/client';
import FavoriteToggle from '@/frontend/components/common/FavoriteToggle';
import PriceTag from '@/frontend/components/products/PriceTag';
import {
  fetchAIRecommendations,
  fetchShopRecommendations,
  getRecommendationSignals,
  type AIRecommendation,
  type ShopRecommendation,
} from '@/frontend/lib/recommendations-client';

const formatKm = (km: number | null | undefined) => (km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

export default function AIRecommendationsSection() {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [shops, setShops] = useState<ShopRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRecommendations = async () => {
      try {
        const { data: { user } } = await getClientUser();
        const signals = await getRecommendationSignals(user?.id ?? null);
        const [results, shopResults] = await Promise.all([
          fetchAIRecommendations(signals),
          fetchShopRecommendations(signals, 4),
        ]);
        if (active) {
          setRecommendations(results);
          setShops(shopResults);
        }
      } catch {
        if (active) setRecommendations([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadRecommendations();
    return () => { active = false; };
  }, []);

  return (
    <section className="bg-slate-50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-700">Selección inteligente</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Recomendados</h2>
          <p className="mt-1 text-sm text-slate-600">Productos relacionados con tus intereses y el catálogo disponible.</p>
        </div>

        {loading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Buscando recomendaciones…</p>
        ) : recommendations.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Aún no hay productos recomendados.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {recommendations.map((recommendation) => (
              <article
                key={recommendation.id}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-accent-300"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  {recommendation.imagen_url ? (
                    <Image src={recommendation.imagen_url} alt={recommendation.nombre} fill unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl text-slate-300">□</div>
                  )}
                  <FavoriteToggle kind="producto" targetId={recommendation.id} className="absolute right-3 top-3 z-10" />
                </div>
                <div className="p-3 sm:p-4">
                  <p className="truncate text-xs font-semibold text-slate-500">{recommendation.tienda_nombre || 'Comercio local'}</p>
                  <Link href={recommendation.tienda_slug ? `/tienda/${encodeURIComponent(recommendation.tienda_slug)}#product-${recommendation.id}` : '/tiendas'} className="mt-1 block truncate text-sm font-bold text-slate-900 group-hover:text-accent-700 sm:text-base">{recommendation.nombre}</Link>
                  {recommendation.motivo && <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-accent-700">✨ {recommendation.motivo}</p>}
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-x-2 gap-y-1 sm:mt-3">
                    <PriceTag price={recommendation.precio} offer={recommendation.precio_oferta} size="sm" className="text-accent-700" />
                    <Link href={recommendation.tienda_slug ? `/tienda/${encodeURIComponent(recommendation.tienda_slug)}#product-${recommendation.id}` : '/tiendas'} className="-my-2 inline-flex min-h-10 items-center text-xs font-bold text-slate-500 hover:text-accent-700">Ver producto →</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {shops.length > 0 && (
          <div className="mt-10">
            <h3 className="text-lg font-extrabold text-slate-900">Comercios recomendados para ti</h3>
            <p className="mt-1 text-sm text-slate-600">Según lo que te interesa, tus comercios favoritos y la cercanía.</p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shops.map((shop) => (
                <Link
                  key={shop.id}
                  href={shop.slug ? `/tienda/${encodeURIComponent(shop.slug)}` : '/comercios'}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-accent-300"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-2xl">
                    {shop.logo_url ? <Image src={shop.logo_url} alt="" fill unoptimized className="object-cover" /> : '🏪'}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{shop.nombre_comercio}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[shop.categoria_principal, shop.distrito, formatKm(shop.distancia_km)].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold text-accent-700">✨ {shop.motivo}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}