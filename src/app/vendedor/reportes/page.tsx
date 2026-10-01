'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getVendorReportData, type VendorReportData } from '@/services/vendor-reports.service';
import { userFacingError } from '@/lib/user-facing-error';

type Period = 'today' | 'last-7-days' | 'this-month' | 'last-month' | 'custom';
type ReportKind = 'ventas' | 'pedidos' | 'productos' | 'tiendas';

const ORDER_STATES = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'completado', 'cancelado'];
const PAGE_SIZE = 25;

const localDateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const currency = (value: number) => `Gs. ${Math.round(value).toLocaleString('es-PY')}`;
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function getPeriodRange(period: Period) {
  const today = new Date();
  const todayValue = localDateValue(today);
  if (period === 'today') return { from: todayValue, to: todayValue };
  if (period === 'last-7-days') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: localDateValue(start), to: todayValue };
  }
  if (period === 'this-month') return { from: localDateValue(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayValue };
  if (period === 'last-month') return {
    from: localDateValue(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    to: localDateValue(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
  return { from: '', to: '' };
}

async function exportPdf(options: { title: string; merchantName: string; storeName: string; period: string; filename: string; head: string[]; rows: Array<Array<string | number>>; summary: string[] }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'landscape' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.text('Portal Comercial Guairá', 14, 16);
  pdf.setFontSize(13);
  pdf.text(options.title, 14, 24);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Comerciante: ${options.merchantName}`, 14, 31);
  pdf.text(`Tienda: ${options.storeName} · Período: ${options.period}`, 14, 36);
  pdf.text(`Generado: ${new Date().toLocaleString('es-PY')}`, 14, 41);
  pdf.text(options.summary.join('   |   '), 14, 48);
  autoTable(pdf, {
    startY: 54,
    head: [options.head],
    body: options.rows,
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });
  pdf.save(options.filename);
}

export default function VendorReportsPage() {
  const initialRange = getPeriodRange('this-month');
  const [period, setPeriod] = useState<Period>('this-month');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [storeId, setStoreId] = useState('');
  const [data, setData] = useState<VendorReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<ReportKind | null>(null);
  const [exportError, setExportError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    getVendorReportData({ storeId, from: from || undefined, to: to || undefined })
      .then((result) => {
        if (!current) return;
        setData(result);
        if (!storeId && result.stores.length === 1) setStoreId(result.stores[0].id);
      })
      .catch((cause) => { if (current) setError(userFacingError(cause, 'No se pudieron generar los reportes.')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [storeId, from, to]);

  const filtered = useMemo(() => {
    if (!data) return null;
    const storeNames = new Map(data.stores.map((store) => [store.id, store.nombre_comercio]));
    const salesTotal = data.sales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
    const ordersByState = Object.fromEntries(ORDER_STATES.map((state) => [state, data.orders.filter((order) => order.estado === state).length]));
    const salesByDay = new Map<string, number>();
    const salesByStore = new Map<string, { count: number; total: number }>();
    for (const sale of data.sales) {
      const day = sale.created_at.slice(0, 10);
      salesByDay.set(day, (salesByDay.get(day) ?? 0) + Number(sale.total ?? 0));
      const entry = salesByStore.get(sale.tienda_id) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(sale.total ?? 0);
      salesByStore.set(sale.tienda_id, entry);
    }

    const soldByProduct = new Map<string, { quantity: number; name: string }>();
    for (const item of data.saleItems ?? []) {
      if (!item.producto_id) continue;
      const entry = soldByProduct.get(item.producto_id) ?? { quantity: 0, name: item.nombre_producto_snapshot };
      entry.quantity += item.cantidad;
      soldByProduct.set(item.producto_id, entry);
    }

    const productById = new Map(data.products.map((product) => [product.id, product]));
    const topSold = [...soldByProduct.entries()]
      .map(([id, sold]) => ({ id, name: productById.get(id)?.titulo || sold.name, quantity: sold.quantity }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5);
    const topViews = [...data.products].sort((left, right) => right.vistas_count - left.vistas_count).slice(0, 5);
    const storeRows = (storeId ? data.stores.filter((store) => store.id === storeId) : data.stores).map((store) => {
      const sales = salesByStore.get(store.id) ?? { count: 0, total: 0 };
      return {
        id: store.id,
        name: store.nombre_comercio,
        orders: data.orders.filter((order) => order.tienda_id === store.id).length,
        sales: sales.count,
        total: sales.total,
        products: data.products.filter((product) => product.tienda_id === store.id).length,
      };
    });

    return {
      storeNames,
      salesTotal,
      salesAverage: data.sales.length ? salesTotal / data.sales.length : 0,
      ordersByState,
      salesByDay: [...salesByDay.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([day, total]) => ({ day, total })),
      salesByStore: [...salesByStore.entries()].map(([id, value]) => ({ name: storeNames.get(id) || 'Tienda', ...value })),
      topSold,
      topViews,
      storeRows,
    };
  }, [data, storeId]);

  const changePeriod = (value: Period) => {
    setPeriod(value);
    if (value !== 'custom') {
      const range = getPeriodRange(value);
      setFrom(range.from);
      setTo(range.to);
    }
    setPage(1);
  };

  const updateDateRange = (nextFrom: string, nextTo: string) => {
    setPeriod('custom');
    setFrom(nextFrom);
    setTo(nextTo);
    setPage(1);
  };

  const changeStore = (value: string) => { setStoreId(value); setPage(1); };
  const periodLabel = from || to ? `${from || 'Inicio'} a ${to || 'Hoy'}` : 'Todo el período';
  const maxDailySales = Math.max(1, ...(filtered?.salesByDay.map((item) => item.total) ?? []));
  const maxStoreSales = Math.max(1, ...(filtered?.salesByStore.map((item) => item.total) ?? []));
  const maxOrdersByState = Math.max(1, ...(ORDER_STATES.map((state) => filtered?.ordersByState[state] ?? 0)));
  const pages = Math.max(1, Math.ceil((data?.sales.length ?? 0) / PAGE_SIZE));
  const pagedSales = data?.sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [];

  const handleExport = async (kind: ReportKind) => {
    if (!data || !filtered) return;
    setExporting(kind);
    setExportError('');
    const storeName = storeId ? filtered.storeNames.get(storeId) ?? 'Tienda' : 'Todas mis tiendas';
    const suffix = `${from || 'todo'}-${to || localDateValue(new Date())}`;
    const base = `reporte-${kind}-${slug(storeName)}-${suffix}.pdf`;
    const date = (value: string) => new Date(value).toLocaleDateString('es-PY');

    try {
      if (kind === 'ventas') {
        await exportPdf({
          title: 'Reporte de ventas', merchantName: data.merchantName, storeName, period: periodLabel, filename: base,
          summary: [`Operaciones: ${data.sales.length}`, `Total: ${currency(filtered.salesTotal)}`, `Promedio: ${currency(filtered.salesAverage)}`],
          head: ['Venta', 'Tienda', 'Fecha', 'Estado', 'Total'],
          rows: data.sales.map((sale) => [sale.numero_venta, filtered.storeNames.get(sale.tienda_id) || '', date(sale.created_at), sale.estado, currency(Number(sale.total))]),
        });
      } else if (kind === 'pedidos') {
        await exportPdf({
          title: 'Reporte de pedidos', merchantName: data.merchantName, storeName, period: periodLabel, filename: base,
          summary: [`Pedidos: ${data.orders.length}`, ...ORDER_STATES.map((state) => `${state.replaceAll('_', ' ')}: ${filtered.ordersByState[state]}`)],
          head: ['Pedido', 'Tienda', 'Fecha', 'Estado', 'Total'],
          rows: data.orders.map((order) => [order.numero_pedido, filtered.storeNames.get(order.tienda_id) || '', date(order.created_at), order.estado.replaceAll('_', ' '), currency(Number(order.total))]),
        });
      } else if (kind === 'productos') {
        await exportPdf({
          title: 'Reporte de productos', merchantName: data.merchantName, storeName, period: periodLabel, filename: base,
          summary: [`Productos: ${data.products.length}`, `Disponibles: ${data.products.filter((product) => product.disponible).length}`, `Destacados: ${data.products.filter((product) => product.destacado).length}`],
          head: ['Producto', 'Tienda', 'Disponible', 'Destacado', 'Vistas', 'Unidades vendidas'],
          rows: data.products.map((product) => [product.titulo, filtered.storeNames.get(product.tienda_id) || '', product.disponible ? 'Sí' : 'No', product.destacado ? 'Sí' : 'No', product.vistas_count, data.saleItems?.filter((item) => item.producto_id === product.id).reduce((sum, item) => sum + item.cantidad, 0) ?? 'No disponible']),
        });
      } else {
        await exportPdf({
          title: 'Reporte por tienda', merchantName: data.merchantName, storeName, period: periodLabel, filename: base,
          summary: [`Tiendas: ${filtered.storeRows.length}`, `Ventas: ${currency(filtered.salesTotal)}`, `Pedidos: ${data.orders.length}`],
          head: ['Tienda', 'Pedidos', 'Ventas', 'Total vendido', 'Productos'],
          rows: filtered.storeRows.map((store) => [store.name, store.orders, store.sales, currency(store.total), store.products]),
        });
      }
    } catch (cause) {
      setExportError(userFacingError(cause, 'No se pudo generar el PDF.'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Análisis del negocio</p><h1 className="mt-1 text-3xl font-black text-slate-900">Reportes</h1><p className="mt-2 text-sm text-slate-600">Filtra tus operaciones y descarga informes basados en Supabase.</p></div>
        <Link href="/vendedor" className="text-sm font-bold text-blue-700 hover:underline">Volver al resumen</Link>
      </header>

      <section className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-slate-600">Período<select value={period} onChange={(event) => changePeriod(event.target.value as Period)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500"><option value="today">Hoy</option><option value="last-7-days">Últimos 7 días</option><option value="this-month">Este mes</option><option value="last-month">Mes anterior</option><option value="custom">Personalizado</option></select></label>
        <label className="text-xs font-semibold text-slate-600">Desde<input type="date" value={from} onChange={(event) => updateDateRange(event.target.value, to)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
        <label className="text-xs font-semibold text-slate-600">Hasta<input type="date" value={to} onChange={(event) => updateDateRange(from, event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
        <label className="text-xs font-semibold text-slate-600">Tienda<select value={storeId} onChange={(event) => changeStore(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"><option value="">Todas mis tiendas</option>{data?.stores.map((store) => <option key={store.id} value={store.id}>{store.nombre_comercio}</option>)}</select></label>
      </section>

      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {exportError && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{exportError}</p>}
      {data?.saleItemsError && <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{data.saleItemsError} El reporte de productos omite unidades vendidas hasta que se habilite esa lectura.</p>}
      {loading && <div className="mb-5 h-20 animate-pulse rounded-2xl bg-slate-100" />}
      {!loading && data?.stores.length === 0 && <p className="border-y border-slate-200 py-10 text-center text-sm text-slate-600">No tienes tiendas asociadas para generar reportes.</p>}

      {data && filtered && data.stores.length > 0 && <>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[['Ventas', data.sales.length.toLocaleString('es-PY')], ['Monto total', currency(filtered.salesTotal)], ['Promedio por venta', currency(filtered.salesAverage)]].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p></article>)}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Ventas por día</h2><p className="mt-1 text-xs text-slate-500">{periodLabel}</p></div><button type="button" onClick={() => void handleExport('ventas')} disabled={exporting !== null} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{exporting === 'ventas' ? 'Generando…' : 'Exportar PDF'}</button></div>
            {filtered.salesByDay.length ? <div className="mt-5 flex h-48 items-end gap-2 overflow-x-auto border-b border-slate-200 pb-2">{filtered.salesByDay.map((item) => <div key={item.day} className="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-2"><div title={currency(item.total)} className="w-full max-w-10 rounded-t-md bg-blue-500" style={{ height: `${Math.max(3, item.total / maxDailySales * 100)}%` }} /><span className="whitespace-nowrap text-[10px] text-slate-500">{new Date(`${item.day}T12:00:00`).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}</span></div>)}</div> : <p className="mt-5 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">No hay ventas para el período seleccionado.</p>}
            <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead className="text-slate-500"><tr><th className="py-2">Número</th><th className="py-2">Tienda</th><th className="py-2">Fecha</th><th className="py-2">Estado</th><th className="py-2 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{pagedSales.map((sale) => <tr key={sale.id}><td className="py-2.5 font-semibold text-slate-800">{sale.numero_venta}</td><td className="py-2.5">{filtered.storeNames.get(sale.tienda_id)}</td><td className="py-2.5">{new Date(sale.created_at).toLocaleDateString('es-PY')}</td><td className="py-2.5 capitalize">{sale.estado}</td><td className="py-2.5 text-right">{currency(Number(sale.total))}</td></tr>)}</tbody></table></div>
            {data.sales.length > PAGE_SIZE && <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Página {page} de {pages}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Anterior</button><button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Siguiente</button></div></div>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Pedidos por estado</h2><p className="mt-1 text-xs text-slate-500">Conteos en el período elegido.</p></div><button type="button" onClick={() => void handleExport('pedidos')} disabled={exporting !== null} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{exporting === 'pedidos' ? 'Generando…' : 'Exportar PDF'}</button></div>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{ORDER_STATES.map((state) => <div key={state} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">{state.replaceAll('_', ' ')}</p><p className="mt-1 text-xl font-black text-slate-900">{filtered.ordersByState[state]}</p></div>)}</div>
            <div className="mt-5 space-y-3" aria-label="Gráfico de pedidos por estado">{ORDER_STATES.map((state) => <div key={state} className="grid grid-cols-[110px_minmax(0,1fr)_32px] items-center gap-3 text-xs"><span className="truncate capitalize text-slate-600">{state.replaceAll('_', ' ')}</span><span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${filtered.ordersByState[state] / maxOrdersByState * 100}%` }} /></span><span className="text-right font-semibold tabular-nums text-slate-700">{filtered.ordersByState[state]}</span></div>)}</div>
            <p className="mt-4 text-xs text-slate-500">Pedidos en el período: {data.orders.length.toLocaleString('es-PY')}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Productos</h2><p className="mt-1 text-xs text-slate-500">Catálogo actual y unidades vendidas en el período.</p></div><button type="button" onClick={() => void handleExport('productos')} disabled={exporting !== null} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{exporting === 'productos' ? 'Generando…' : 'Exportar PDF'}</button></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Productos</p><p className="mt-1 text-xl font-black">{data.products.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Disponibles</p><p className="mt-1 text-xl font-black">{data.products.filter((product) => product.disponible).length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Destacados</p><p className="mt-1 text-xl font-black">{data.products.filter((product) => product.destacado).length}</p></div></div>
            <h3 className="mt-5 text-sm font-bold text-slate-800">Más vistos</h3>
            {filtered.topViews.length ? <ul className="mt-2 divide-y divide-slate-100">{filtered.topViews.map((product) => <li key={product.id} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate">{product.titulo}</span><span className="shrink-0 text-slate-500">{product.vistas_count} vistas</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No hay productos registrados.</p>}
            <h3 className="mt-5 text-sm font-bold text-slate-800">Más vendidos</h3>
            {data.saleItems === null ? <p className="mt-2 text-sm text-amber-800">{data.saleItemsError}</p> : filtered.topSold.length ? <ul className="mt-2 divide-y divide-slate-100">{filtered.topSold.map((product) => <li key={product.id} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate">{product.name}</span><span className="shrink-0 text-slate-500">{product.quantity} uds.</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-600">No hay productos vendidos en el período seleccionado.</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Rendimiento por tienda</h2><p className="mt-1 text-xs text-slate-500">Operaciones y productos de cada tienda.</p></div><button type="button" onClick={() => void handleExport('tiendas')} disabled={exporting !== null} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{exporting === 'tiendas' ? 'Generando…' : 'Exportar PDF'}</button></div>
            {filtered.storeRows.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Tienda</th><th className="py-2">Pedidos</th><th className="py-2">Ventas</th><th className="py-2 text-right">Total vendido</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.storeRows.map((store) => <tr key={store.id}><td className="py-3 font-semibold text-slate-800">{store.name}</td><td className="py-3">{store.orders}</td><td className="py-3">{store.sales}</td><td className="py-3 text-right">{currency(store.total)}</td></tr>)}</tbody></table></div> : <p className="mt-5 text-sm text-slate-600">No hay tiendas asociadas.</p>}
            <div className="mt-5 space-y-3">{filtered.salesByStore.map((store) => <div key={store.name}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-slate-600">{store.name}</span><span className="font-semibold text-slate-800">{currency(store.total)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${store.total / maxStoreSales * 100}%` }} /></div></div>)}</div>
          </section>
        </div>
      </>}
    </main>
  );
}