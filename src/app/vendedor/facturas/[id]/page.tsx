'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getMyStoreInvoiceById } from '@/services/invoices.service';
import type { FacturaDetalle, FacturaInterna } from '@/types/database';
import { userFacingError } from '@/lib/user-facing-error';

type InvoiceDetails = { invoice: FacturaInterna; storeName: string; details: FacturaDetalle[] };
const currency = (value: number | string | null) => `Gs. ${Number(value ?? 0).toLocaleString('es-PY')}`;

export default function VendorInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id;
  const [data, setData] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    if (!invoiceId) {
      setError('No se encontró la factura solicitada.');
      setLoading(false);
      return;
    }
    getMyStoreInvoiceById(invoiceId)
      .then((result) => {
        if (!current) return;
        if (!result) setError('No se encontró una factura asociada a tus tiendas.');
        else setData(result);
      })
      .catch((cause) => { if (current) setError(userFacingError(cause, 'No se pudo cargar la factura.')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [invoiceId]);

  const downloadPdf = async () => {
    if (!data) return;
    setExporting(true);
    setError('');
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const { invoice, details, storeName } = data;
      const pdf = new jsPDF();
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Portal Comercial Guairá', 14, 18);
      pdf.setFontSize(14);
      pdf.text(`Factura ${invoice.numero}`, 14, 28);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Tienda: ${storeName}`, 14, 37);
      pdf.text(`Fecha: ${new Date(invoice.fecha).toLocaleDateString('es-PY')} · Estado: ${invoice.estado}`, 14, 43);
      pdf.text(`Tipo: ${invoice.tipo_documento} · Moneda: ${invoice.moneda}`, 14, 49);
      pdf.text(`Cliente: ${invoice.cliente_id || 'No especificado'} · Pedido: ${invoice.pedido_id}`, 14, 55);
      autoTable(pdf, {
        startY: 63,
        head: [['Descripción', 'Cantidad', 'Precio', 'Descuento', 'Subtotal']],
        body: details.map((item) => [item.descripcion_snapshot, String(item.cantidad), currency(item.precio), currency(item.descuento), currency(item.subtotal)]),
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [37, 99, 235] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });
      const finalY = (pdf as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 70;
      autoTable(pdf, {
        startY: finalY + 8,
        body: [
          ['Subtotal', currency(invoice.subtotal)],
          ['Descuento', currency(invoice.descuento)],
          ['IVA', currency(invoice.iva)],
          ['Total', currency(invoice.total)],
        ],
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 120, right: 14 },
      });
      const filename = `factura-${invoice.numero.replace(/[^a-zA-Z0-9-]/g, '-')}.pdf`;
      pdf.save(filename);
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo generar el PDF de la factura.'));
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">Cargando factura...</main>;
  if (error || !data) return <main className="mx-auto max-w-5xl px-4 py-12"><p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error || 'No se pudo cargar la factura.'}</p><Link href="/comerciante/facturas" className="mt-5 inline-flex font-bold text-blue-700 hover:underline">Volver a facturas</Link></main>;

  const { invoice, storeName, details } = data;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Link href="/comerciante/facturas" className="text-sm font-bold text-blue-700 hover:underline">← Facturas</Link><button type="button" onClick={() => void downloadPdf()} disabled={exporting} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{exporting ? 'Generando PDF…' : 'Descargar PDF'}</button></div>
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 bg-slate-50 p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Comprobante interno</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-black text-slate-900">Factura {invoice.numero}</h1><p className="mt-1 text-sm text-slate-600">{storeName}</p></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold capitalize text-slate-700">{invoice.estado}</span></div></header>
        <div className="grid gap-4 border-b border-slate-100 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3"><div><p className="text-xs font-semibold text-slate-500">Fecha</p><p className="mt-1 text-sm font-bold text-slate-900">{new Date(invoice.fecha).toLocaleDateString('es-PY')}</p></div><div><p className="text-xs font-semibold text-slate-500">Tipo de documento</p><p className="mt-1 text-sm font-bold capitalize text-slate-900">{invoice.tipo_documento}</p></div><div><p className="text-xs font-semibold text-slate-500">Moneda</p><p className="mt-1 text-sm font-bold text-slate-900">{invoice.moneda}</p></div><div><p className="text-xs font-semibold text-slate-500">Cliente asociado</p><p className="mt-1 break-all text-sm font-bold text-slate-900">{invoice.cliente_id || 'No especificado'}</p></div><div><p className="text-xs font-semibold text-slate-500">Pedido</p><p className="mt-1 break-all text-sm font-bold text-slate-900">{invoice.pedido_id}</p></div><div><p className="text-xs font-semibold text-slate-500">Venta</p><p className="mt-1 break-all text-sm font-bold text-slate-900">{invoice.venta_id}</p></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-white text-xs uppercase text-slate-500"><tr><th className="px-6 py-3 sm:px-8">Descripción</th><th className="px-4 py-3">Cantidad</th><th className="px-4 py-3">Precio</th><th className="px-4 py-3">Descuento</th><th className="px-6 py-3 text-right sm:px-8">Subtotal</th></tr></thead><tbody className="divide-y divide-slate-100">{details.map((item) => <tr key={item.id}><td className="px-6 py-4 font-semibold text-slate-800 sm:px-8">{item.descripcion_snapshot}</td><td className="px-4 py-4">{item.cantidad}</td><td className="px-4 py-4">{currency(item.precio)}</td><td className="px-4 py-4">{currency(item.descuento)}</td><td className="px-6 py-4 text-right font-semibold sm:px-8">{currency(item.subtotal)}</td></tr>)}</tbody></table></div>
        <footer className="border-t border-slate-200 bg-slate-50 p-6 sm:p-8"><dl className="ml-auto max-w-sm space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-600">Subtotal</dt><dd className="font-semibold">{currency(invoice.subtotal)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-600">Descuento</dt><dd className="font-semibold">{currency(invoice.descuento)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-600">IVA registrado</dt><dd className="font-semibold">{currency(invoice.iva)}</dd></div><div className="flex justify-between gap-4 border-t border-slate-200 pt-3 text-base font-black text-slate-900"><dt>Total</dt><dd>{currency(invoice.total)}</dd></div></dl><p className="mt-6 text-xs text-slate-500">Este documento refleja los datos almacenados en la factura interna; no representa una factura fiscal ni una integración SIFEN.</p></footer>
      </article>
    </main>
  );
}