'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getMyStoreSales, getMyStoreSalesStats } from '@/services/sales.service';
import type { Venta } from '@/types/database';
import { userFacingError } from '@/lib/user-facing-error';

export default function VendorSalesPage() {
  const [sales, setSales] = useState<Venta[]>([]);
  const [stats, setStats] = useState({ totalVentas: 0, ventasHoy: 0, ventasMes: 0, cantidadOperaciones: 0, promedioPorVenta: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyStoreSales(), getMyStoreSalesStats()])
      .then(([result, summary]) => {
        setSales(result);
        setStats(summary);
      })
      .catch((loadError) => setError(userFacingError(loadError, 'No se pudieron cargar las ventas. Inténtalo de nuevo.')))
      .finally(() => setLoading(false));
  }, []);

  const summaryCards = useMemo(
    () => [
      { label: 'Ventas totales', value: `Gs. ${Number(stats.totalVentas).toLocaleString('es-PY')}` },
      { label: 'Ventas del día', value: `Gs. ${Number(stats.ventasHoy).toLocaleString('es-PY')}` },
      { label: 'Ventas del mes', value: `Gs. ${Number(stats.ventasMes).toLocaleString('es-PY')}` },
      { label: 'Operaciones', value: String(stats.cantidadOperaciones) },
      { label: 'Promedio', value: `Gs. ${Number(stats.promedioPorVenta).toLocaleString('es-PY')}` },
    ],
    [stats]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase text-emerald-700">Comercio</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Ventas</h1>
        </div>
        <Link href="/comerciante/dashboard" className="text-sm font-bold text-blue-700 hover:underline">Volver al dashboard</Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">{card.label}</p>
            <p className="mt-3 text-xl font-black text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-sm text-slate-500">Cargando ventas...</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      {!loading && !error && sales.length === 0 && (
        <div className="border-y border-slate-200 py-12 text-center text-sm text-slate-600">Todavía no hay ventas registradas para tu tienda.</div>
      )}

      {!loading && sales.length > 0 && (
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Venta</th>
                <th className="px-4 py-3 font-bold">Pedido</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Pago</th>
                <th className="px-4 py-3 font-bold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sales.map((sale) => (
                <tr key={sale.id}>
                  <td className="px-4 py-4 font-bold text-slate-900">{sale.numero_venta}</td>
                  <td className="px-4 py-4 text-slate-700">{sale.pedido_id}</td>
                  <td className="px-4 py-4 text-slate-600">{new Date(sale.created_at).toLocaleDateString('es-PY')}</td>
                  <td className="px-4 py-4 text-slate-700">{sale.cliente_id || 'Cliente'}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">Gs. {Number(sale.total).toLocaleString('es-PY')}</td>
                  <td className="px-4 py-4 capitalize text-slate-700">{sale.metodo_pago}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">
                      {sale.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
