'use client';

/**
 * [PÁGINA] Página /pedidos/enviar?ids=a,b,c (cliente): envío de un carrito MULTITIENDA.
 *
 * Después de confirmar un carrito con productos de varios comercios se crea un pedido por comercio.
 * Esta página muestra, para CADA comercio, su ticket y su botón "Enviar por WhatsApp" (mensaje
 * estructurado + imagen del ticket + enlace de cada producto), y marca cuáles ya se enviaron.
 */
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getMyOrder, type PedidoConTienda } from '@/frontend/services/orders.service';
import type { PedidoDetalle } from '@/shared/types/database';
import OrderTicket from '@/frontend/components/orders/OrderTicket';
import { formatGs } from '@/frontend/lib/order-ticket';

type LoadedOrder = { pedido: PedidoConTienda; detalles: PedidoDetalle[] };

const UUID = /^[0-9a-f-]{36}$/i;

function SendOrders() {
  const searchParams = useSearchParams();
  const ids = (searchParams.get('ids') || '').split(',').filter((id) => UUID.test(id)).slice(0, 20);
  const idsKey = ids.join(',');
  const [orders, setOrders] = useState<LoadedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all(idsKey.split(',').filter(Boolean).map((id) => getMyOrder(id)))
      .then((results) => {
        if (!active) return;
        setOrders(results.filter((order): order is NonNullable<typeof order> => Boolean(order)));
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los pedidos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [idsKey]);

  const total = orders.reduce((sum, order) => sum + Number(order.pedido.total || 0), 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <section className="no-print rounded-3xl border border-emerald-200 bg-white px-6 py-8 text-center">
        <p className="text-sm font-bold uppercase text-emerald-700">Pedidos registrados</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">
          {orders.length > 1 ? `${orders.length} pedidos, uno por comercio` : 'Tu pedido'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Envía cada pedido por WhatsApp a su comercio con el botón de su ticket. Cada comercio recibe solo sus productos.
        </p>
        {orders.length > 0 && <p className="mt-3 text-sm font-bold text-slate-800">Total de la compra: {formatGs(total)}</p>}
        {orders.length > 1 && (
          <ol className="mx-auto mt-4 max-w-md space-y-1 text-left text-sm">
            {orders.map(({ pedido }, index) => (
              <li key={pedido.id}>
                <a href={`#ticket-${pedido.id}`} className="font-semibold text-primary-700 hover:underline">
                  {index + 1}. {pedido.tienda?.nombre_comercio || 'Comercio'} — {formatGs(pedido.total)}
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      {loading && <p role="status" className="mt-8 text-center text-sm text-slate-500">Cargando tus pedidos…</p>}
      {error && <p role="alert" className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

      <div className="mt-8 space-y-12">
        {orders.map(({ pedido, detalles }, index) => (
          <section key={pedido.id} id={`ticket-${pedido.id}`} className="scroll-mt-24">
            <h2 className="no-print mb-3 text-sm font-black uppercase tracking-wide text-slate-600">
              Comercio {index + 1} de {orders.length}: {pedido.tienda?.nombre_comercio || 'Comercio'}
            </h2>
            <OrderTicket pedido={pedido} detalles={detalles} highlightWhatsApp />
          </section>
        ))}
      </div>

      <div className="no-print mt-10 text-center">
        <Link href="/pedidos" className="text-sm font-bold text-primary-700 hover:underline">Ver todos mis pedidos</Link>
      </div>
    </main>
  );
}

export default function SendOrdersPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-slate-500">Cargando…</p>}>
      <SendOrders />
    </Suspense>
  );
}
