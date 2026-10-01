'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { showAppConfirm, showAppMessage } from '@/lib/app-message';
import { userFacingError } from '@/lib/user-facing-error';
import { getOrderStateLabel, getStoreOrderById, ORDER_STATUS_FLOW, updateVendorOrderStatus } from '@/services/orders.service';
import type { PedidoDetalle, PedidoEstadoHistorial } from '@/types/database';

export default function VendorOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const [pedido, setPedido] = useState<any | null>(null);
  const [detalles, setDetalles] = useState<PedidoDetalle[]>([]);
  const [historial, setHistorial] = useState<PedidoEstadoHistorial[]>([]);
  const [documentos, setDocumentos] = useState<{ venta: any | null; factura: any | null }>({ venta: null, factura: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      setError('No se encontró el pedido.');
      setLoading(false);
      return;
    }

    try {
      const result = await getStoreOrderById(orderId);
      if (!result) {
        setError('No se encontró este pedido asociado a tu tienda.');
        setPedido(null);
        return;
      }

      setPedido(result.pedido);
      setDetalles(result.detalles);
      setHistorial(result.historial);
      setDocumentos({ venta: result.venta, factura: result.factura });
    } catch (loadError) {
      setError(userFacingError(loadError, 'No se pudo cargar el pedido. Inténtalo de nuevo.'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleStatusTransition = async (nextState: string) => {
    if (!orderId || !pedido) return;
    const confirmed = await showAppConfirm(`¿Deseas actualizar este pedido a "${getOrderStateLabel(nextState)}"?`, 'Confirmación');
    if (!confirmed) return;

    try {
      setSaving(true);
      await updateVendorOrderStatus(orderId, nextState, 'Estado actualizado por el comerciante desde la gestión del pedido.');
      await loadOrder();
      showAppMessage('Pedido actualizado correctamente.', 'Éxito', 'success');
    } catch (updateError) {
      showAppMessage(userFacingError(updateError, 'No se pudo actualizar el pedido. Inténtalo de nuevo.'), 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-slate-500">Cargando pedido...</main>;
  }

  if (error || !pedido) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error || 'No se pudo cargar el pedido.'}</p>
        <Link href="/comerciante/pedidos" className="mt-5 inline-flex font-bold text-blue-700 hover:underline">Volver a gestión</Link>
      </main>
    );
  }

  const statusOptions = ORDER_STATUS_FLOW[pedido.estado] ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/comerciante/pedidos" className="text-sm font-bold text-blue-700 hover:underline">← Gestión de pedidos</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase text-emerald-700">Pedido</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">{pedido.numero_pedido}</h1>
        </div>
        <div className="text-sm text-slate-600">
          <p>Estado: <strong className="text-slate-900">{getOrderStateLabel(pedido.estado)}</strong></p>
          <p>Pago: <strong className="text-slate-900">{pedido.estado_pago}</strong></p>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        {statusOptions.length === 0 ? (
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">Sin acciones disponibles</span>
        ) : (
          statusOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleStatusTransition(option)}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Procesando...' : `Marcar como ${getOrderStateLabel(option)}`}
            </button>
          ))
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">Productos</h2>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {detalles.map((detail) => (
              <article key={detail.id} className="flex justify-between gap-4 py-4">
                <div>
                  <p className="font-bold text-slate-900">{detail.nombre_producto_snapshot}</p>
                  {detail.descripcion_snapshot && <p className="mt-1 text-sm text-slate-500">{detail.descripcion_snapshot}</p>}
                  <p className="mt-1 text-sm text-slate-600">{detail.cantidad} × Gs. {Number(detail.precio).toLocaleString('es-PY')}</p>
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
                  <p className="font-semibold capitalize text-slate-800">{getOrderStateLabel(entry.estado_nuevo)}</p>
                  <p className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString('es-PY')}</p>
                  {entry.observacion && <p className="text-sm text-slate-600">{entry.observacion}</p>}
                </li>
              ))}
            </ol>
          </section>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-bold text-slate-900">Resumen</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Subtotal</dt><dd>Gs. {Number(pedido.subtotal).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Descuento</dt><dd>- Gs. {Number(pedido.descuento).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Envío</dt><dd>Gs. {Number(pedido.envio).toLocaleString('es-PY')}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black"><dt>Total</dt><dd>Gs. {Number(pedido.total).toLocaleString('es-PY')}</dd></div>
          </dl>
          <div className="mt-5 space-y-2 text-sm text-slate-600">
            <p>Cliente: {pedido.usuario_id || 'Usuario'}</p>
            <p>Entrega: {pedido.direccion_entrega}</p>
            <p>Método de pago: {pedido.metodo_pago}</p>
            <p>Notas: {pedido.notas || 'Sin observaciones.'}</p>
          </div>
        </aside>
      </div>

      <section className="mt-8 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-bold text-slate-900">Documentos relacionados</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {documentos.venta && <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Venta</p>
            <p className="mt-1 font-bold text-slate-900">{documentos.venta.numero_venta}</p>
            <p className="mt-1 text-xs capitalize text-slate-600">{documentos.venta.estado} · Gs. {Number(documentos.venta.total).toLocaleString('es-PY')}</p>
          </article>}
          {documentos.factura && <Link href={`/comerciante/facturas/${documentos.factura.id}`} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Factura</p>
            <p className="mt-1 font-bold text-slate-900">{documentos.factura.numero}</p>
            <p className="mt-1 text-xs capitalize text-slate-600">{documentos.factura.estado} · Gs. {Number(documentos.factura.total).toLocaleString('es-PY')}</p>
            <span className="mt-3 inline-block text-xs font-bold text-emerald-700">Abrir factura →</span>
          </Link>}
          {!documentos.venta && !documentos.factura && <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Aún no hay venta ni factura vinculadas a este pedido.</p>}
        </div>
      </section>
    </main>
  );
}
