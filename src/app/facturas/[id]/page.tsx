'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getInvoiceById } from '@/services/invoices.service';
import type { FacturaDetalle, FacturaInterna } from '@/types/database';

export default function FacturaDetailPage() {
  const params = useParams<{ id: string }>();
  const itemId = params?.id;
  const [factura, setFactura] = useState<FacturaInterna | null>(null);
  const [detalles, setDetalles] = useState<FacturaDetalle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) {
      setError('No se encontró la factura.');
      setLoading(false);
      return;
    }

    getInvoiceById(itemId)
      .then((result) => {
        if (!result) {
          setError('No tienes acceso a esta factura o aún no existe.');
          return;
        }
        setFactura(result.factura);
        setDetalles(result.detalles);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la factura.');
      })
      .finally(() => setLoading(false));
  }, [itemId]);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">Cargando factura...</main>;
  }

  if (error || !factura) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error || 'No se pudo cargar la factura.'}</p>
        <Link href="/facturas" className="mt-5 inline-flex font-bold text-blue-700 hover:underline">Volver a mis facturas</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/facturas" className="text-sm font-bold text-blue-700 hover:underline">← Mis facturas</Link>
      <header className="mt-5 border-b border-slate-200 pb-5">
        <p className="text-xs font-black uppercase text-blue-700">Documento</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">{factura.numero}</h1>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold text-slate-900">Detalle de productos</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {detalles.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No se registraron productos en esta factura.</p>
            ) : (
              detalles.map((detail) => (
                <div key={detail.id} className="flex flex-col justify-between gap-2 py-4 sm:flex-row">
                  <div>
                    <p className="font-bold text-slate-900">{detail.descripcion_snapshot}</p>
                    <p className="text-sm text-slate-500">Cantidad: {detail.cantidad}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">Gs. {Number(detail.precio).toLocaleString('es-PY')}</p>
                    <p className="font-bold text-slate-900">Subtotal: Gs. {Number(detail.subtotal).toLocaleString('es-PY')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-bold text-slate-900">Resumen fiscal</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Estado</dt><dd className="font-semibold text-slate-900">{factura.estado}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Tipo</dt><dd className="font-semibold text-slate-900">{factura.tipo_documento}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Fecha</dt><dd className="font-semibold text-slate-900">{new Date(factura.fecha).toLocaleDateString('es-PY')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Moneda</dt><dd className="font-semibold text-slate-900">{factura.moneda}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd>Gs. {Number(factura.subtotal).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Descuento</dt><dd>- Gs. {Number(factura.descuento).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">IVA</dt><dd>Gs. {Number(factura.iva).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black"><dt>Total</dt><dd>Gs. {Number(factura.total).toLocaleString('es-PY')}</dd></div>
          </dl>
          <p className="mt-5 text-xs italic text-slate-500">Si la factura aún no está aprobada por el sistema fiscal, su estado indica la situación real del documento.</p>
        </aside>
      </div>
    </main>
  );
}
