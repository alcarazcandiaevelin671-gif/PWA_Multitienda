'use client';

/**
 * [PÁGINA] Página /admin/reportes: reporte global por período, con exportación a PDF y CSV.
 */
import { useEffect, useState } from 'react';
import type { AdminReport } from '@/shared/lib/admin-report';

const currency = (value: number) => `Gs. ${Math.round(value).toLocaleString('es-PY')}`;
const localDate = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const label = (value: string) => value.replaceAll('_', ' ');
/** Escapa comillas y evita que una planilla ejecute el texto como fórmula. */
const csvCell = (value: string | number) => {
  const text = typeof value === 'number' ? String(value) : value.replace(/^([=+\-@\t\r])/, "'$1");
  return `"${text.replaceAll('"', '""')}"`;
};
const HEAD = ['Comercio', 'Distrito', 'Estado', 'Pedidos', 'Cancelados', 'Monto (Gs.)'];

function summary(report: AdminReport): Array<[string, string]> {
  const { resumen } = report;
  return [
    ['Pedidos', resumen.pedidos.toLocaleString('es-PY')],
    ['Monto (sin cancelados)', currency(resumen.montoPedidos)],
    ['Promedio por pedido', currency(resumen.promedioPorPedido)],
    ['Pedidos no cancelados', resumen.pedidosNoCancelados.toLocaleString('es-PY')],
    ['Usuarios nuevos', resumen.usuariosNuevos.toLocaleString('es-PY')],
    ['Clientes nuevos', resumen.clientesNuevos.toLocaleString('es-PY')],
    ['Comerciantes nuevos', resumen.comerciantesNuevos.toLocaleString('es-PY')],
  ];
}

export default function AdminReportsPage() {
  const [from, setFrom] = useState(() => { const now = new Date(); return localDate(new Date(now.getFullYear(), now.getMonth(), 1)); });
  const [to, setTo] = useState(() => localDate(new Date()));
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (from) params.set('desde', from);
        if (to) params.set('hasta', to);
        const response = await fetch(`/api/admin/reportes?${params}`, { cache: 'no-store' });
        const body = await response.json().catch(() => ({})) as AdminReport & { error?: string };
        if (!response.ok) throw new Error(body.error || 'No se pudo generar el reporte.');
        if (active) setReport(body);
      } catch (cause) {
        if (active) { setReport(null); setError(cause instanceof Error ? cause.message : 'No se pudo generar el reporte.'); }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [from, to]);

  const period = `${from || 'inicio'} a ${to || 'hoy'}`;
  const fileName = `reporte-general-${from || 'inicio'}-${to || 'hoy'}`;
  const rows: Array<Array<string | number>> = report?.porComercio.map((row) => [row.comercio, row.distrito, label(row.estado), row.pedidos, row.cancelados, row.total]) ?? [];
  const states = Object.entries(report?.pedidosPorEstado ?? {});
  const maxState = Math.max(1, ...states.map(([, total]) => total));

  const exportCsv = () => {
    const content = [HEAD, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!report) return;
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const pdf = new jsPDF();
      const style = { styles: { fontSize: 8 }, headStyles: { fillColor: [219, 39, 119] as [number, number, number] } };
      pdf.setFontSize(16);
      pdf.text('Portal Comercial Guairá: reporte general', 14, 16);
      pdf.setFontSize(9);
      pdf.text(`Período: ${period} · Generado: ${new Date().toLocaleString('es-PY')}`, 14, 23);
      autoTable(pdf, { startY: 28, head: [['Indicador', 'Valor']], body: summary(report), ...style });
      autoTable(pdf, { head: [['Estado del pedido', 'Cantidad']], body: states.map(([state, total]) => [label(state), total]), ...style });
      autoTable(pdf, { head: [HEAD], body: rows.map((row) => [...row.slice(0, 5), currency(Number(row[5]))]), ...style });
      pdf.save(`${fileName}.pdf`);
    } catch {
      setError('No se pudo generar el PDF.');
    }
  };

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-700">Administración</p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900">Reportes</h2>
          <p className="mt-1 text-sm text-slate-600">Totales de pedidos, comercios y usuarios. No incluye datos personales de clientes.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={!report || loading} onClick={() => void exportPdf()} className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">Exportar PDF</button>
          <button type="button" disabled={!report || loading} onClick={exportCsv} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Exportar CSV</button>
        </div>
      </header>

      <section className="mb-5 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold text-slate-600">Desde<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
        <label className="text-xs font-semibold text-slate-600">Hasta<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
        <button type="button" onClick={() => { setFrom(''); setTo(''); }} className="self-end rounded-xl px-3 py-2 text-sm font-semibold text-primary-700 hover:underline">Todo el período</button>
      </section>

      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {loading && <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />}

      {report && !loading && <>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary(report).map(([name, value]) => <article key={name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">{name}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p></article>)}
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Pedidos por estado</h3>
            <div className="mt-4 space-y-3">{states.map(([state, total]) => <div key={state} className="grid grid-cols-[110px_minmax(0,1fr)_40px] items-center gap-3 text-xs"><span className="capitalize text-slate-600">{label(state)}</span><span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-primary-500" style={{ width: `${total / maxState * 100}%` }} /></span><span className="text-right font-semibold text-slate-700">{total}</span></div>)}</div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Por distrito</h3>
            <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Distrito</th><th className="py-2">Comercios</th><th className="py-2">Pedidos</th><th className="py-2 text-right">Monto</th></tr></thead><tbody className="divide-y divide-slate-100">{report.porDistrito.map((row) => <tr key={row.distrito}><td className="py-2.5 font-semibold text-slate-800">{row.distrito}</td><td className="py-2.5">{row.comercios}</td><td className="py-2.5">{row.pedidos}</td><td className="py-2.5 text-right">{currency(row.total)}</td></tr>)}</tbody></table></div>
          </section>
        </div>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">Por comercio</h3>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr>{HEAD.map((name, index) => <th key={name} className={`py-2 ${index === 5 ? 'text-right' : ''}`}>{name}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{report.porComercio.map((row, index) => <tr key={`${row.comercio}-${index}`}><td className="py-2.5 font-semibold text-slate-800">{row.comercio}</td><td className="py-2.5">{row.distrito}</td><td className="py-2.5 capitalize">{label(row.estado)}</td><td className="py-2.5">{row.pedidos}</td><td className="py-2.5">{row.cancelados}</td><td className="py-2.5 text-right">{currency(row.total)}</td></tr>)}</tbody></table></div>
        </section>
      </>}
    </div>
  );
}
