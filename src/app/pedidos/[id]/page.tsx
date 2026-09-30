'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getMyOrder } from '@/services/orders.service';
import type { PedidoConTienda } from '@/services/orders.service';
import type { PedidoDetalle, PedidoEstadoHistorial } from '@/types/database';

type OrderDetails = {
  pedido: PedidoConTienda;
  detalles: PedidoDetalle[];
  historial: PedidoEstadoHistorial[];
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No se encontró este pedido.');
      setLoading(false);
      return;
    }

    getMyOrder(id)
      .then((result) => {
        if (!result) setError('No se encontró este pedido.');
        else setData(result);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el pedido.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">Cargando pedido...</main>;
  if (error || !data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error || 'No se pudo cargar el pedido.'}</p>
        <Link href="/pedidos" className="mt-5 inline-flex font-bold text-blue-700 hover:underline">Volver a mis pedidos</Link>
      </main>
    );
  }

  const { pedido, detalles, historial } = data;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/pedidos" className="text-sm font-bold text-blue-700 hover:underline">← Mis pedidos</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase text-blue-700">{pedido.tienda?.nombre_comercio || 'Tienda'}</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">{pedido.numero_pedido}</h1>
        </div>
        <div className="text-sm text-slate-600">
          <p>Estado: <strong className="capitalize text-slate-900">{pedido.estado.replaceAll('_', ' ')}</strong></p>
          <p>Pago: <strong className="capitalize text-slate-900">{pedido.estado_pago}</strong></p>
        </div>
      </header>

      <div className="grid gap-10 py-8 lg:grid-cols-[1fr_300px]">
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">Productos</h2>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {detalles.map((detail) => (
              <article key={detail.id} className="flex justify-between gap-4 py-4">
                <div>
                  <p className="font-bold text-slate-900">{detail.nombre_producto_snapshot}</p>
                  {detail.descripcion_snapshot && <p className="mt-1 text-sm text-slate-500">{detail.descripcion_snapshot}</p>}
                  <p className="mt-1 text-sm text-slate-600">{detail.cantidad} × Gs. {Number(detail.precio).toLocaleString('es-PY')}</p>
                  {Number(detail.descuento) > 0 && <p className="text-xs text-emerald-700">Descuento: Gs. {Number(detail.descuento).toLocaleString('es-PY')}</p>}
                </div>
                <p className="whitespace-nowrap font-bold text-slate-800">Gs. {Number(detail.subtotal).toLocaleString('es-PY')}</p>
              </article>
            ))}
          </div>
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-slate-900">Historial</h2>
            <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
              {historial.map((entry) => (
                <li key={entry.id}>
                  <p className="font-semibold capitalize text-slate-800">{entry.estado_nuevo.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString('es-PY')}</p>
                  {entry.observacion && <p className="text-sm text-slate-600">{entry.observacion}</p>}
                </li>
              ))}
            </ol>
          </section>
        </section>

        <aside className="h-fit border-y border-slate-200 py-5">
          <h2 className="text-lg font-bold text-slate-900">Resumen</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd>Gs. {Number(pedido.subtotal).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Descuento</dt><dd>- Gs. {Number(pedido.descuento).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Envío</dt><dd>Gs. {Number(pedido.envio).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black"><dt>Total</dt><dd>Gs. {Number(pedido.total).toLocaleString('es-PY')}</dd></div>
          </dl>
          <p className="mt-5 text-sm text-slate-600">Entrega: {pedido.direccion_entrega}</p>
          <p className="mt-2 text-sm text-slate-600">Pago: {pedido.metodo_pago}</p>
        </aside>
      </div>
    </main>
  );
}