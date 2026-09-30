'use client';

import { useEffect, useState } from 'react';

type ReportData = {
  sales: Array<Record<string, unknown>>;
  salesTotal: number;
  salesPage: number;
  orders: Array<Record<string, unknown>>;
  ordersTotal: number;
  ordersPage: number;
  pageSize: number;
  statuses: string[];
  options: {
    districts: Array<{ id: number; nombre: string }>;
    categories: Array<{ id: number; nombre: string }>;
    shops: Array<{ id: string; nombre_comercio: string }>;
  };
};

function amount(value: unknown) {
  return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Number(value ?? 0)) + ' Gs.';
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState('');
  const [shop, setShop] = useState('');
  const [status, setStatus] = useState('');
  const [salesPage, setSalesPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setSalesPage(1);
    setOrdersPage(1);
  };

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (district) params.set('district', district);
    if (category) params.set('category', category);
    if (shop) params.set('shop', shop);
    if (status) params.set('status', status);
    params.set('salesPage', String(salesPage));
    params.set('ordersPage', String(ordersPage));

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/reportes?${params}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo generar el reporte.');
        setData(result);
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'No se pudo generar el reporte.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [from, to, district, category, shop, status, salesPage, ordersPage, reload]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Análisis</p><h2 className="mt-1 text-2xl font-extrabold text-white">Reportes</h2><p className="mt-1 text-sm text-slate-400">Pedidos y ventas reales; resultados paginados a 25 filas por conjunto.</p></div><button type="button" onClick={() => setReload((value) => value + 1)} disabled={loading} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50">Actualizar</button></div>
      <div className="mb-4 grid gap-2 rounded-xl border border-white/10 bg-[#111f31] p-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="text-xs text-slate-400">Desde<input type="date" value={from} onChange={(event) => changeFilter(setFrom)(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200" /></label>
        <label className="text-xs text-slate-400">Hasta<input type="date" value={to} onChange={(event) => changeFilter(setTo)(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200" /></label>
        <label className="text-xs text-slate-400">Distrito<select value={district} onChange={(event) => changeFilter(setDistrict)(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos</option>{data?.options.districts.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="text-xs text-slate-400">Categoría<select value={category} onChange={(event) => changeFilter(setCategory)(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todas</option>{data?.options.categories.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
        <label className="text-xs text-slate-400">Comercio<select value={shop} onChange={(event) => changeFilter(setShop)(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos</option>{data?.options.shops.map((item) => <option key={item.id} value={item.id}>{item.nombre_comercio}</option>)}</select></label>
        <label className="text-xs text-slate-400">Estado<select value={status} onChange={(event) => changeFilter(setStatus)(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#091321] px-3 py-2 text-sm text-slate-200"><option value="">Todos</option>{data?.statuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
      </div>
      {error && <div role="alert" className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      <div className="grid gap-5 xl:grid-cols-2">
        {(['orders', 'sales'] as const).map((kind) => {
          const rows = data?.[kind] ?? [];
          const title = kind === 'orders' ? 'Pedidos' : 'Ventas';
          const count = kind === 'orders' ? data?.ordersTotal : data?.salesTotal;
          const numberField = kind === 'orders' ? 'numero_pedido' : 'numero_venta';
          const page = kind === 'orders' ? ordersPage : salesPage;
          const maxPages = Math.max(1, Math.ceil((count ?? 0) / (data?.pageSize ?? 25)));
          const setPage = kind === 'orders' ? setOrdersPage : setSalesPage;
          return <section key={kind} className="overflow-hidden rounded-xl border border-white/10 bg-[#111f31]"><div className="border-b border-white/[0.07] px-4 py-3"><h3 className="font-bold text-white">{title}</h3><p className="mt-1 text-xs text-slate-400">{loading ? 'Consultando…' : `${(count ?? 0).toLocaleString('es-PY')} coincidencias · ${rows.length} en esta página`}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3">Número</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Fecha</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr> : rows.length ? rows.map((row, index) => <tr key={String(row.id ?? index)} className="text-slate-300"><td className="px-4 py-3">{String(row[numberField] ?? '—')}</td><td className="px-4 py-3 capitalize">{String(row.estado ?? '—').replaceAll('_', ' ')}</td><td className="px-4 py-3">{amount(row.total)}</td><td className="px-4 py-3">{row.created_at ? new Date(String(row.created_at)).toLocaleDateString('es-PY') : '—'}</td></tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">Sin resultados para estos filtros.</td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t border-white/[0.07] px-4 py-3 text-xs text-slate-400"><span>Página {page} de {maxPages}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={loading || page <= 1} className="rounded-md border border-white/10 px-3 py-1.5 font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40">Anterior</button><button type="button" onClick={() => setPage((value) => Math.min(maxPages, value + 1))} disabled={loading || page >= maxPages} className="rounded-md border border-white/10 px-3 py-1.5 font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40">Siguiente</button></div></div></section>;
        })}
      </div>
    </div>
  );
}