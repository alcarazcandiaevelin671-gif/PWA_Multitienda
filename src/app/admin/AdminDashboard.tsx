'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type DashboardData = {
  counts: Record<string, number>;
  districts: Array<{ name: string; count: number }>;
  shopStatuses: Array<{ name: string; count: number }>;
  activity: Array<{ id: number | null; accion: string | null; tabla_afectada: string | null; fecha_hora: string | null }>;
  activityUnavailable: boolean;
};

const cardGroups = [
  {
    title: 'Cuentas',
    cards: [
      { key: 'users', label: 'Usuarios', color: 'text-sky-300' },
      { key: 'customers', label: 'Clientes', color: 'text-cyan-300' },
      { key: 'vendors', label: 'Comerciantes', color: 'text-violet-300' },
    ],
  },
  {
    title: 'Comercios',
    cards: [
      { key: 'shops', label: 'Registrados', color: 'text-emerald-300' },
      { key: 'pendingShops', label: 'Pendientes', color: 'text-amber-300', href: '/admin/comercios?estado=pendiente' },
      { key: 'activeShops', label: 'Activos', color: 'text-green-300' },
    ],
  },
];

const cardIcons: Record<string, string> = {
  users: '♙',
  customers: '♧',
  vendors: '▣',
  shops: '⌂',
  pendingShops: '◷',
  activeShops: '✓',
};

const shopStatusStyles: Record<string, string> = {
  Pendientes: 'bg-amber-400',
  Activos: 'bg-emerald-400',
  Rechazados: 'bg-rose-400',
};

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

  const maxDistrict = Math.max(1, ...(data?.districts.map((item) => item.count) ?? []));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Vista general</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Panel administrativo</h2>
            <p className="mt-1 text-sm text-slate-600">Usuarios, comercios y actividad reciente.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-slate-50 disabled:opacity-50">{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </header>

      {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"><span>{error}</span><button onClick={() => void load()} className="font-bold underline">Reintentar</button></div>}

      <div className="space-y-6">
        {cardGroups.map((group) => <section key={group.title} aria-labelledby={`admin-${group.title.toLowerCase()}-title`}>
          <div className="mb-3 flex items-center gap-3"><h3 id={`admin-${group.title.toLowerCase()}-title`} className="text-sm font-extrabold text-slate-800">{group.title}</h3><span className="h-px flex-1 bg-slate-200" /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.cards.map((card) => {
              const content = <><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold leading-5 text-slate-400">{card.label}</p><span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-base ${card.color}`}>{cardIcons[card.key]}</span></div><p className={`mt-3 text-3xl font-extrabold tabular-nums ${card.color}`}>{loading ? '—' : data?.counts[card.key] ?? '—'}</p></>;
              return card.href ? <Link key={card.key} href={card.href} className="flex min-h-28 flex-col justify-between rounded-xl border border-white/10 bg-[#111f31] p-4 transition hover:border-sky-300/40">{content}</Link> : <article key={card.key} className="flex min-h-28 flex-col justify-between rounded-xl border border-white/10 bg-[#111f31] p-4">{content}</article>;
            })}
          </div>
        </section>)}
      </div>

      <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <section className="rounded-xl border border-white/10 bg-[#111f31] p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-white">Actividad reciente</h3><p className="mt-1 text-xs text-slate-400">Registro de auditoría</p></div><Link href="/admin/auditorias" className="shrink-0 text-xs font-semibold text-sky-300 hover:text-sky-200">Ver todo</Link></div>
          {data?.activityUnavailable ? <p className="mt-3 rounded-lg bg-amber-300/10 p-3 text-xs leading-5 text-amber-200">La política RLS no permitió consultar la auditoría.</p> : data?.activity.length ? <ul className="mt-2 divide-y divide-white/[0.06]">{data.activity.map((item, index) => <li key={item.id ?? index} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{item.accion || 'Acción registrada'} <span className="font-normal text-slate-400">· {item.tabla_afectada || 'Registro'}</span></p></div><time className="shrink-0 text-[10px] tabular-nums text-slate-500">{item.fecha_hora ? new Date(item.fecha_hora).toLocaleString('es-PY') : 'Fecha no disponible'}</time></li>)}</ul> : <p className="mt-3 text-sm text-slate-400">No hay acciones auditadas.</p>}
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-xl border border-white/10 bg-[#111f31] p-4">
            <h3 className="font-bold text-white">Comercios por distrito</h3>
            <p className="mt-1 text-xs text-slate-400">Cantidad de comercios registrados.</p>
            {loading ? <div className="mt-3 h-28 animate-pulse rounded-lg bg-white/5" /> : data?.districts.length ? <ul role="img" aria-label="Gráfico de comercios por distrito" className="mt-3 flex h-32 items-end gap-1 overflow-x-auto border-b border-white/10 pb-2 sm:gap-1.5">
              {data.districts.map((item) => <li key={item.name} title={`${item.name}: ${item.count}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 text-center">
                <span className="text-[9px] font-bold tabular-nums text-slate-300">{item.count}</span>
                <div className="flex h-20 w-full items-end justify-center"><span className="w-3/5 max-w-7 rounded-t bg-violet-400 transition-[height] duration-500 ease-out hover:bg-violet-300" style={{ height: `${Math.max(8, (item.count / maxDistrict) * 100)}%` }} /></div>
                <span className="w-full truncate text-[8px] text-slate-400">{item.name}</span>
              </li>)}
            </ul> : <p className="mt-3 text-sm text-slate-400">No hay comercios registrados por distrito.</p>}
          </section>

          <section className="rounded-xl border border-white/10 bg-[#111f31] p-4">
            <h3 className="font-bold text-white">Estado de los comercios</h3>
            <p className="mt-1 text-xs text-slate-400">Conteo actual por estado.</p>
            {loading ? <div className="mt-3 h-24 animate-pulse rounded-lg bg-white/5" /> : data?.shopStatuses.length ? <ul className="mt-2 divide-y divide-white/[0.06]">
              {data.shopStatuses.map((item) => <li key={item.name} className="flex items-center justify-between gap-4 py-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-300"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${shopStatusStyles[item.name] ?? 'bg-slate-400'}`} />{item.name}</span>
                <span className="text-lg font-extrabold tabular-nums text-white">{item.count}</span>
              </li>)}
            </ul> : <p className="mt-3 text-sm text-slate-400">No hay estados de comercio registrados.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}