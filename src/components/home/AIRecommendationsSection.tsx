'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import FavoriteToggle from '@/components/common/FavoriteToggle';
import { fetchAIRecommendations, getRecommendationSignals, type AIRecommendation } from '@/lib/recommendations-client';

export default function AIRecommendationsSection() {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRecommendations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const signals = await getRecommendationSignals(user?.id ?? null);
        const results = await fetchAIRecommendations(signals);
        if (active) setRecommendations(results);
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
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-700">Selección inteligente</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Recomendados</h2>
          <p className="mt-1 text-sm text-slate-600">Productos relacionados con tus intereses y el catálogo disponible.</p>
        </div>

        {loading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Buscando recomendaciones…</p>
        ) : recommendations.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Aún no hay productos recomendados.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recommendations.map((recommendation) => (
              <article
                key={recommendation.id}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-sky-300"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  {recommendation.imagen_url ? (
                    <Image src={recommendation.imagen_url} alt={recommendation.nombre} fill unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl text-slate-300">□</div>
                  )}
                  <FavoriteToggle kind="producto" targetId={recommendation.id} className="absolute right-3 top-3 z-10" />
                </div>
                <div className="p-4">
                  <p className="truncate text-xs font-semibold text-slate-500">{recommendation.tienda_nombre || 'Comercio local'}</p>
                  <Link href={recommendation.tienda_slug ? `/tienda/${encodeURIComponent(recommendation.tienda_slug)}#product-${recommendation.id}` : '/tiendas'} className="mt-1 block truncate text-base font-bold text-slate-900 group-hover:text-sky-700">{recommendation.nombre}</Link>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-sky-700">{recommendation.precio.toLocaleString('es-PY')} Gs.</span>
                    <Link href={recommendation.tienda_slug ? `/tienda/${encodeURIComponent(recommendation.tienda_slug)}#product-${recommendation.id}` : '/tiendas'} className="text-xs font-bold text-slate-500 hover:text-sky-700">Ver producto →</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}