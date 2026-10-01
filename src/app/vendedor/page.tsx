'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getVendorDashboardData, type VendorDashboardData } from '@/services/vendor-dashboard.service';
import { userFacingError } from '@/lib/user-facing-error';

const currency = (value: number) => `Gs. ${Math.round(value).toLocaleString('es-PY')}`;

const shortcuts = [
  { href: '/vendedor/tiendas', label: 'Mis tiendas', detail: 'Ver negocios asociados', color: 'text-blue-700', accent: 'bg-blue-50' },
  { href: '/comerciante/productos', label: 'Productos', detail: 'Administrar catálogo', color: 'text-emerald-700', accent: 'bg-emerald-50' },
  { href: '/comerciante/pedidos', label: 'Pedidos', detail: 'Revisar compras recibidas', color: 'text-amber-700', accent: 'bg-amber-50' },
  { href: '/comerciante/ventas', label: 'Ventas', detail: 'Consultar operaciones', color: 'text-cyan-700', accent: 'bg-cyan-50' },
  { href: '/comerciante/facturas', label: 'Facturas', detail: 'Consultar documentos', color: 'text-violet-700', accent: 'bg-violet-50' },
  { href: '/vendedor/reportes', label: 'Reportes', detail: 'Filtrar y exportar datos', color: 'text-rose-700', accent: 'bg-rose-50' },
];

export default function VendorHomePage() {
  const [data, setData] = useState<VendorDashboardData | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    getVendorDashboardData(selectedStoreId || undefined)
      .then((result) => {
        if (current) setData(result);
      })
      .catch((cause) => {
        if (current) setError(userFacingError(cause, 'No se pudo cargar el resumen del comercio.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => { current = false; };
  }, [selectedStoreId]);

  const metrics = data ? [
    { label: 'Tiendas activas', value: `${data.counts.activeStores} / ${data.counts.stores}`, color: 'text-blue-700' },
    { label: 'Productos publicados', value: data.counts.availableProducts.toLocaleString('es-PY'), color: 'text-emerald-700' },
    { label: 'Pedidos recibidos', value: data.counts.orders.toLocaleString('es-PY'), color: 'text-slate-900' },
    { label: 'Pedidos pendientes', value: data.counts.pendingOrders.toLocaleString('es-PY'), color: 'text-amber-700' },
    { label: 'Ventas acumuladas', value: currency(data.counts.salesTotal), color: 'text-cyan-800' },
    { label: 'Ventas del mes', value: currency(data.counts.salesMonth), color: 'text-violet-700' },
    { label: 'Facturas emitidas', value: data.counts.invoices.toLocaleString('es-PY'), color: 'text-rose-700' },
  ] : [];
  const maxSales = Math.max(1, ...(data?.salesByDay.map((item) => item.total) ?? []));

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Área del comerciante</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">{data ? `Hola, ${data.merchantName}` : 'Resumen del negocio'}</h1>
          <p className="mt-2 text-sm text-slate-600">Monitorea tus tiendas, pedidos y ventas en un solo lugar.</p>
        </div>
        {data && data.stores.length > 1 && (
          <label className="w-full max-w-xs text-sm font-semibold text-slate-700">
            Tienda
            <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="">Todas mis tiendas</option>
              {data.stores.map((store) => <option key={store.id} value={store.id}>{store.nombre_comercio}</option>)}
            </select>
          </label>
        )}
      </header>

      {error && <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}

      {!loading && !error && data?.stores.length === 0 && (
        <section className="mb-7 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">Tu espacio comercial</p>
          <h2 className="mt-2 text-xl font-black text-slate-900">Todavía no tienes tiendas asociadas</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Registra o termina de configurar tu comercio para empezar a gestionar productos y recibir pedidos.</p>
          <Link href="/comerciante/tienda" className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">Configurar mi tienda</Link>
        </section>
      )}

      <section aria-label="Indicadores del negocio" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? Array.from({ length: 7 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />) : metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className={`mt-2 truncate text-2xl font-black tabular-nums ${metric.color}`} title={metric.value}>{metric.value}</p>
          </article>
        ))}
      </section>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-bold text-slate-900">Ventas de los últimos 7 días</h2><p className="mt-1 text-xs text-slate-500">Importes agregados desde las ventas de tus tiendas.</p></div>
            <Link href="/vendedor/reportes" className="text-xs font-bold text-blue-700 hover:underline">Ver reportes</Link>
          </div>
          {loading ? <div className="mt-6 h-40 animate-pulse rounded-xl bg-slate-100" /> : data?.salesByDay.length ? (
            <div className="mt-6 grid grid-cols-7 gap-2 sm:gap-4" aria-label="Gráfico de ventas diarias">
              {data.salesByDay.map((item) => (
                <div key={item.day} className="flex min-w-0 flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end justify-center border-b border-slate-200 pb-1">
                    <div title={currency(item.total)} className="w-full max-w-9 rounded-t-md bg-blue-500" style={{ height: `${Math.max(item.total ? 6 : 2, item.total / maxSales * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500">{new Date(`${item.day}T12:00:00`).toLocaleDateString('es-PY', { weekday: 'short' })}</span>
                </div>
              ))}
            </div>
          ) : <p className="mt-6 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">No hay ventas para este período.</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-slate-900">Accesos rápidos</h2><Link href="/vendedor/tiendas" className="text-xs font-bold text-blue-700 hover:underline">Todas mis tiendas</Link></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {shortcuts.map((shortcut) => (
              <Link key={shortcut.href} href={shortcut.href} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-slate-50">
                <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${shortcut.accent} ${shortcut.color}`}>↗</span>
                <span className="min-w-0"><span className={`block truncate text-sm font-bold ${shortcut.color}`}>{shortcut.label}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{shortcut.detail}</span></span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><h2 className="font-bold text-slate-900">Pedidos recientes</h2><p className="mt-1 text-xs text-slate-500">Últimas compras recibidas por tus tiendas.</p></div>
          <Link href="/comerciante/pedidos" className="text-sm font-bold text-blue-700 hover:underline">Ver pedidos</Link>
        </div>
        {loading ? <p className="px-5 py-8 text-sm text-slate-500">Cargando pedidos...</p> : data?.recentOrders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Pedido</th><th className="px-5 py-3">Tienda</th><th className="px-5 py-3">Fecha</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentOrders.map((order) => <tr key={order.id} className="text-slate-700"><td className="px-5 py-3 font-bold text-slate-900"><Link href={`/comerciante/pedidos/${order.id}`} className="hover:text-blue-700">{order.numero_pedido}</Link></td><td className="px-5 py-3">{order.tienda_nombre}</td><td className="px-5 py-3">{new Date(order.created_at).toLocaleDateString('es-PY')}</td><td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize">{order.estado.replaceAll('_', ' ')}</span></td><td className="px-5 py-3 text-right font-semibold">{currency(Number(order.total))}</td></tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="px-5 py-8 text-center text-sm text-slate-600">No hay pedidos para mostrar.</p>}
      </section>
    </main>
  );
}