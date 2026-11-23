'use client';

/**
 * [FRONTEND] "Pedidos sin enviar": pedidos guardados sin conexión, con reintento y descarte.
 */
import { useEffect, useState } from 'react';
import { createOrder } from '@/frontend/services/orders.service';
import {
  OFFLINE_ORDERS_EVENT,
  flushQueuedOrders,
  getQueuedOrders,
  removeQueuedOrder,
  retryQueuedOrder,
  type QueuedOrder,
} from '@/frontend/lib/offline-orders';
import { formatGs } from '@/frontend/lib/order-ticket';
import { showAppConfirm } from '@/frontend/lib/app-message';

/** Pedidos confirmados sin conexión que todavía no llegaron al servidor. */
export default function QueuedOrdersPanel({ onSynced }: { onSynced?: () => void }) {
  const [queued, setQueued] = useState<QueuedOrder[]>([]);
  const [online, setOnline] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let previousCount = getQueuedOrders().length;
    const refresh = () => {
      const next = getQueuedOrders();
      if (next.length < previousCount) onSynced?.(); // se envió alguno: recargar la lista de pedidos
      previousCount = next.length;
      setQueued(next);
    };
    const updateOnline = () => setOnline(navigator.onLine);
    refresh();
    updateOnline();
    window.addEventListener(OFFLINE_ORDERS_EVENT, refresh);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener(OFFLINE_ORDERS_EVENT, refresh);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, [onSynced]);

  if (queued.length === 0) return null;

  const retry = async (order?: QueuedOrder) => {
    // Volver a intentar un pedido rechazado (por ejemplo, si la tienda ya fue activada).
    if (order?.estado === 'error') retryQueuedOrder(order.localId);
    setRetrying(true);
    try {
      await flushQueuedOrders(createOrder);
    } finally {
      setRetrying(false);
      setQueued(getQueuedOrders());
    }
  };

  const discard = async (order: QueuedOrder) => {
    const confirmed = await showAppConfirm('¿Descartar este pedido guardado? No se enviará al comercio.');
    if (confirmed) removeQueuedOrder(order.localId);
  };

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-black text-slate-900">📡 Pedidos sin enviar ({queued.length})</h2>
          <p className="text-xs text-slate-600">
            {online
              ? 'Hay conexión: se están enviando. Si alguno fue rechazado, podés reintentarlo o descartarlo.'
              : 'Se guardaron sin conexión y se enviarán solos cuando vuelva internet.'}
          </p>
        </div>
        {online && (
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {retrying ? 'Enviando…' : 'Enviar ahora'}
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {queued.map((order) => (
          <li key={order.localId} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900">{order.resumen.tienda}</p>
                <p className="text-xs text-slate-500">
                  Guardado el {new Date(order.createdAt).toLocaleString('es-PY')} · {order.origen === 'whatsapp' ? 'vía WhatsApp' : 'checkout'}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {order.resumen.items.map((item) => `${item.cantidad}× ${item.nombre}`).join(', ')}
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-slate-900">{formatGs(order.resumen.total)}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  order.estado === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {order.estado === 'error' ? 'Rechazado' : 'Pendiente de envío'}
                </span>
              </div>
            </div>
            {order.estado === 'error' && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 px-3 py-2">
                <p className="text-xs text-rose-700">{order.error}</p>
                <div className="flex gap-2">
                  {online && (
                    <button type="button" onClick={() => void retry(order)} className="text-xs font-bold text-primary-700 hover:underline">
                      Reintentar
                    </button>
                  )}
                  <button type="button" onClick={() => void discard(order)} className="text-xs font-bold text-rose-700 hover:underline">
                    Descartar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
