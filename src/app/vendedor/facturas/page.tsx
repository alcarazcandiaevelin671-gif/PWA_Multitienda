'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getMyStoreInvoices } from '@/services/invoices.service';
import type { FacturaInterna } from '@/types/database';
import { userFacingError } from '@/lib/user-facing-error';

export default function VendorInvoicesPage() {
  const [invoices, setInvoices] = useState<FacturaInterna[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('todos');

  useEffect(() => {
    getMyStoreInvoices()
      .then(setInvoices)
      .catch((loadError) => setError(userFacingError(loadError, 'No se pudieron cargar las facturas. Inténtalo de nuevo.')))
      .finally(() => setLoading(false));
  }, []);

  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => statusFilter === 'todos' || invoice.estado === statusFilter),
    [invoices, statusFilter]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase text-emerald-700">Comercio</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Facturación</h1>
        </div>
        <Link href="/comerciante" className="text-sm font-bold text-blue-700 hover:underline">Volver al panel de comerciante</Link>
      </div>

      <div className="mb-6 max-w-xs rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">
          Estado
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="emitida">Emitida</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </label>
      </div>

      {loading && <p className="py-10 text-center text-sm text-slate-500">Cargando facturas...</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {!loading && !error && filteredInvoices.length === 0 && (
        <div className="border-y border-slate-200 py-12 text-center text-sm text-slate-600">No hay facturas relacionadas con tu comercio.</div>
      )}

      {!loading && filteredInvoices.length > 0 && (
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Factura</th>
                <th className="px-4 py-3 font-bold">Venta</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Tipo</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-4 font-bold text-slate-900">{invoice.numero}</td>
                  <td className="px-4 py-4 text-slate-700">{invoice.venta_id}</td>
                  <td className="px-4 py-4 text-slate-700">{invoice.cliente_id || 'Cliente'}</td>
                  <td className="px-4 py-4 text-slate-600">{new Date(invoice.fecha).toLocaleDateString('es-PY')}</td>
                  <td className="px-4 py-4 capitalize text-slate-700">{invoice.tipo_documento}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">Gs. {Number(invoice.total).toLocaleString('es-PY')}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                      {invoice.estado}
                    </span>
                  </td>
                  <td className="px-4 py-4"><Link href={`/comerciante/facturas/${invoice.id}`} className="font-bold text-blue-700 hover:underline">Ver factura</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
