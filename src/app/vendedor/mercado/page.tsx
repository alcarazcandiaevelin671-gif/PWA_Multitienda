'use client';

/**
 * [PÁGINA] Página /vendedor/mercado: sugerencias de mercado para el comerciante.
 * Son cálculos estadísticos simples hechos en la base (no un modelo predictivo): proyección lineal de ventas,
 * tendencia semanal, productos por reponer e interés de los clientes por categoría en los últimos 14 días.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/shared/supabase/client';
import { buildMerchantInsights, type InsightOrder, type InsightProduct, type MerchantInsights } from '@/shared/lib/merchant-insights';
import { userFacingError } from '@/shared/lib/user-facing-error';

type TrendRow = { categoria_id: number; actividad_reciente: number; actividad_anterior: number; productos_disponibles: number };
type Trend = { id: number; nombre: string; reciente: number; anterior: number; disponibles: number };

const currency = (value: number) => `Gs. ${Math.round(value).toLocaleString('es-PY')}`;

/** Sugerencia en palabras a partir de la actividad y la oferta de la categoría. */
function suggestion(trend: Trend) {
  if (trend.reciente === 0) return 'Sin actividad en los últimos 7 días.';
  if (trend.disponibles === 0) return 'Hay interés y ningún producto publicado: oportunidad para ofrecerlo.';
  if (trend.reciente > trend.anterior && trend.disponibles <= 2) return 'Interés en aumento y poca oferta: conviene publicar más.';
  if (trend.reciente > trend.anterior) return 'Interés en aumento.';
  if (trend.reciente < trend.anterior) return 'Interés en baja: una oferta puede ayudar.';
  return 'Interés estable.';
}

export default function VendorMarketPage() {
  const [insights, setInsights] = useState<MerchantInsights | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [scope, setScope] = useState('todo Guairá');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Inicia sesión para continuar.');
      const { data: shop } = await supabase.from('tiendas').select('id, distrito_id').eq('usuario_id', user.id).limit(1).maybeSingle();
      if (!shop) throw new Error('Todavía no tienes una tienda registrada.');
      const districtId = (shop.distrito_id as number | null | undefined) ?? null;
      const [ordersResult, productsResult, trendsResult, categoriesResult, districtResult] = await Promise.all([
        supabase.rpc('obtener_pedidos_mis_tiendas'),
        supabase.from('productos').select('titulo, stock, stock_minimo').eq('tienda_id', shop.id).is('eliminado_en', null),
        supabase.rpc('tendencias_categorias_mercado', districtId == null ? {} : { p_distrito_id: districtId }),
        supabase.from('categorias').select('id, nombre'),
        supabase.from('distritos').select('nombre').eq('id', districtId ?? 0).maybeSingle(),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (productsResult.error) throw productsResult.error;
      if (trendsResult.error) throw trendsResult.error;
      if (!active) return;
      const names = new Map(((categoriesResult.data ?? []) as Array<{ id: number; nombre: string }>).map((item) => [item.id, item.nombre]));
      setScope((districtResult.data as { nombre?: string } | null)?.nombre ?? 'todo Guairá');
      setInsights(buildMerchantInsights(
        (ordersResult.data ?? []) as unknown as InsightOrder[],
        (productsResult.data ?? []) as unknown as InsightProduct[],
        new Date(),
      ));
      setTrends(((trendsResult.data ?? []) as unknown as TrendRow[]).map((row) => ({
        id: row.categoria_id,
        nombre: names.get(row.categoria_id) ?? 'Categoría',
        reciente: Number(row.actividad_reciente),
        anterior: Number(row.actividad_anterior),
        disponibles: Number(row.productos_disponibles),
      })));
    };
    load()
      .catch((cause) => { if (active) setError(userFacingError(cause, 'No se pudieron cargar las sugerencias.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const withActivity = trends.filter((trend) => trend.reciente > 0 || trend.anterior > 0);
  const cards: Array<[string, string, string]> = insights ? [
    ['Proyección del mes', currency(insights.proyeccionMes), 'Promedio diario de los últimos 7 días × 30 (sin cancelados)'],
    ['Tendencia semanal', insights.tendencia == null ? 'Sin base' : `${insights.tendencia.toLocaleString('es-PY')} %`, insights.tendencia == null ? 'No hubo ventas en los 7 días anteriores' : 'Últimos 7 días frente a los 7 anteriores'],
    ['Productos por reponer', String(insights.porReponer.length), insights.porReponer.slice(0, 3).join(', ') || 'Ninguno llegó a su aviso de stock'],
  ] : [];

  return (
    <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Mi negocio</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Sugerencias de mercado</h1>
          <p className="mt-2 text-sm text-slate-600">Estimaciones a partir de tus ventas y de la actividad reciente de los clientes. Son orientativas.</p>
        </div>
        <Link href="/comerciante" className="text-sm font-bold text-primary-700 hover:underline">Volver al resumen</Link>
      </header>

      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {loading && <div className="mb-5 h-20 animate-pulse rounded-2xl bg-slate-100" />}

      {insights && <>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {cards.map(([label, value, help]) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{help}</p></article>
          ))}
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Interés por categoría en {scope}</h2>
          <p className="mt-1 text-xs text-slate-500">Suma ponderada de búsquedas, visitas y compras de los últimos 7 días, comparada con los 7 anteriores.</p>
          {withActivity.length === 0
            ? <p className="mt-5 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">No hay actividad suficiente en los últimos 14 días.</p>
            : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Categoría</th><th className="py-2">Últimos 7 días</th><th className="py-2">7 anteriores</th><th className="py-2">Productos publicados</th><th className="py-2">Sugerencia</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{withActivity.map((trend) => (
                <tr key={trend.id}><td className="py-3 font-semibold text-slate-800">{trend.nombre}</td><td className="py-3">{trend.reciente}</td><td className="py-3">{trend.anterior}</td><td className="py-3">{trend.disponibles}</td><td className="py-3 text-slate-600">{suggestion(trend)}</td></tr>
              ))}</tbody>
            </table></div>}
        </section>
      </>}
    </main>
  );
}
