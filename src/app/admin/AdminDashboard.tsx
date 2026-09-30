'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type DashboardData = {
  counts: Record<string, number>;
  trends: Array<{ month: string; orders: number; sales: number }>;
  districts: Array<{ name: string; count: number }>;
  categories: Array<{ name: string; count: number }>;
  shopStatuses: Array<{ name: string; count: number }>;
  activity: Array<{ id: number | null; accion: string | null; tabla_afectada: string | null; fecha_hora: string | null }>;
  activityUnavailable: boolean;
};

const cards = [
  { key: 'users', label: 'Usuarios', color: 'text-sky-300' },
  { key: 'customers', label: 'Clientes', color: 'text-cyan-300' },
  { key: 'vendors', label: 'Vendedores', color: 'text-violet-300' },
  { key: 'shops', label: 'Comercios', color: 'text-emerald-300' },
  { key: 'pendingShops', label: 'Pendientes', color: 'text-amber-300', href: '/admin/comercios?estado=pendiente' },
  { key: 'activeShops', label: 'Comercios activos', color: 'text-green-300' },
  { key: 'products', label: 'Productos disponibles', color: 'text-blue-300' },
  { key: 'orders', label: 'Pedidos', color: 'text-sky-300' },
  { key: 'sales', label: 'Ventas registradas', color: 'text-emerald-300' },
  { key: 'invoices', label: 'Facturas emitidas', color: 'text-violet-300' },
];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar el panel.');
      setData(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const maxTrend = Math.max(1, ...(data?.trends.flatMap((item) => [item.orders, item.sales]) ?? []));
  const maxDistrict = Math.max(1, ...(data?.districts.map((item) => item.count) ?? []));
  const maxCategory = Math.max(1, ...(data?.categories.map((item) => item.count) ?? []));
  const maxShopStatus = Math.max(1, ...(data?.shopStatuses.map((item) => item.count) ?? []));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Vista general</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Panel administrativo</h2>
          <p className="mt-1 text-sm text-slate-400">Indicadores consultados directamente desde Supabase.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50">{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>

      {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"><span>{error}</span><button onClick={() => void load()} className="font-bold underline">Reintentar</button></div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const content = <><p className="text-xs font-semibold leading-5 text-slate-400">{card.label}</p><p className={`mt-2 text-3xl font-extrabold tabular-nums ${card.color}`}>{loading ? '—' : data?.counts[card.key] ?? '—'}</p></>;
          return card.href ? <Link key={card.key} href={card.href} className="rounded-xl border border-white/10 bg-[#111f31] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)] transition hover:border-sky-300/40">{content}</Link> : <article key={card.key} className="rounded-xl border border-white/10 bg-[#111f31] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">{content}</article>;
        })}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="rounded-xl border border-white/10 bg-[#111f31] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-bold text-white">Actividad mensual</h3><p className="mt-1 text-xs text-slate-400">Cantidad de pedidos y ventas en los últimos seis meses</p></div>
            <div className="flex gap-4 text-xs text-slate-300"><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-sky-400" />Pedidos</span><span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400" />Ventas</span></div>
          </div>
          {loading ? <div className="mt-8 h-36 animate-pulse rounded-lg bg-white/5" /> : data?.trends.length ? <div className="mt-7 grid grid-cols-6 gap-2 sm:gap-4" aria-label="Gráfico de pedidos y ventas por mes">
            {data.trends.map((item) => <div key={item.month} className="flex min-w-0 flex-col items-center gap-2"><div className="flex h-32 w-full items-end justify-center gap-1 border-b border-white/10 pb-1"><div title={`${item.orders} pedidos`} className="w-3 rounded-t bg-sky-400/90 sm:w-5" style={{ height: `${Math.max(item.orders ? 8 : 2, (item.orders / maxTrend) * 100)}%` }} /><div title={`${item.sales} ventas`} className="w-3 rounded-t bg-emerald-400/90 sm:w-5" style={{ height: `${Math.max(item.sales ? 8 : 2, (item.sales / maxTrend) * 100)}%` }} /></div><span className="truncate text-[10px] capitalize text-slate-400">{item.month}</span><span className="text-[10px] tabular-nums text-slate-500">{item.orders} / {item.sales}</span></div>)}
          </div> : <p className="mt-8 text-sm text-slate-400">No hay actividad registrada en este periodo.</p>}
        </section>

        <section className="rounded-xl border border-white/10 bg-[#111f31] p-5">
          <div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Actividad reciente</h3><p className="mt-1 text-xs text-slate-400">Registro de auditoría</p></div><Link href="/admin/auditorias" className="text-xs font-semibold text-sky-300 hover:text-sky-200">Ver todo</Link></div>
          {data?.activityUnavailable ? <p className="mt-5 rounded-lg bg-amber-300/10 p-3 text-xs leading-5 text-amber-200">La política RLS no permitió consultar la auditoría.</p> : data?.activity.length ? <ul className="mt-4 divide-y divide-white/5">{data.activity.map((item, index) => <li key={item.id ?? index} className="py-3"><p className="text-sm font-semibold text-slate-200">{item.accion || 'Acción registrada'}</p><p className="mt-1 text-xs text-slate-500">{item.tabla_afectada || 'Registro'} · {item.fecha_hora ? new Date(item.fecha_hora).toLocaleString('es-PY') : 'Fecha no disponible'}</p></li>)}</ul> : <p className="mt-5 text-sm text-slate-400">No hay acciones auditadas.</p>}
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-[#111f31] p-5">
          <h3 className="font-bold text-white">Comercios por distrito</h3>
          <p className="mt-1 text-xs text-slate-400">Conteos exactos por distrito registrado.</p>
          {loading ? <div className="mt-5 h-28 animate-pulse rounded-lg bg-white/5" /> : data?.districts.length ? <ul className="mt-4 space-y-3">{data.districts.map((item) => <li key={item.name} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-3 text-xs"><span className="truncate text-slate-300">{item.name}</span><span className="h-2 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-violet-400" style={{ width: `${(item.count / maxDistrict) * 100}%` }} /></span><span className="w-6 text-right tabular-nums text-slate-400">{item.count}</span></li>)}</ul> : <p className="mt-5 text-sm text-slate-400">No hay comercios registrados por distrito.</p>}
        </section>
        <section className="rounded-xl border border-white/10 bg-[#111f31] p-5">
          <h3 className="font-bold text-white">Productos por categoría</h3>
          <p className="mt-1 text-xs text-slate-400">Conteos exactos por categoría registrada.</p>
          {loading ? <div className="mt-5 h-28 animate-pulse rounded-lg bg-white/5" /> : data?.categories.length ? <ul className="mt-4 space-y-3">{data.categories.map((item) => <li key={item.name} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-3 text-xs"><span className="truncate text-slate-300">{item.name}</span><span className="h-2 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${(item.count / maxCategory) * 100}%` }} /></span><span className="w-6 text-right tabular-nums text-slate-400">{item.count}</span></li>)}</ul> : <p className="mt-5 text-sm text-slate-400">No hay productos clasificados por categoría.</p>}
        </section>
        <section className="rounded-xl border border-white/10 bg-[#111f31] p-5">
          <h3 className="font-bold text-white">Estado de los comercios</h3>
          <p className="mt-1 text-xs text-slate-400">Distribución por estados reconocidos en la plataforma.</p>
          {loading ? <div className="mt-5 h-28 animate-pulse rounded-lg bg-white/5" /> : data?.shopStatuses.length ? <ul className="mt-4 space-y-3">{data.shopStatuses.map((item) => <li key={item.name} className="grid grid-cols-[minmax(0,1fr)_2fr_auto] items-center gap-3 text-xs"><span className="truncate text-slate-300">{item.name}</span><span className="h-2 overflow-hidden rounded-full bg-white/5"><span className="block h-full rounded-full bg-sky-400" style={{ width: `${(item.count / maxShopStatus) * 100}%` }} /></span><span className="w-6 text-right tabular-nums text-slate-400">{item.count}</span></li>)}</ul> : <p className="mt-5 text-sm text-slate-400">No hay estados de comercio registrados.</p>}
        </section>
      </div>
    </div>
  );
}