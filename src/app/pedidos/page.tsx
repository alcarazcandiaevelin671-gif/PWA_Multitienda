'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getMyOrders, getOrderStateLabel, type PedidoConTienda } from '@/services/orders.service';
import { userFacingError } from '@/lib/user-facing-error';

export default function OrdersPage() {
  const [orders, setOrders] = useState<PedidoConTienda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [query, setQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .catch((loadError) => setError(userFacingError(loadError, 'No se pudieron cargar los pedidos. Inténtalo de nuevo.')))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = orders.length;
    const pendientes = orders.filter((order) => order.estado === 'pendiente').length;
    const enPreparacion = orders.filter((order) => order.estado === 'en_preparacion').length;
    const completados = orders.filter((order) => order.estado === 'completado').length;
    return { total, pendientes, enPreparacion, completados };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return [...orders]
      .filter((order) => {
        const matchesState = statusFilter === 'todos' || order.estado === statusFilter;
        const matchesQuery = !query || order.numero_pedido.toLowerCase().includes(query.toLowerCase());
        return matchesState && matchesQuery;
      })
      .sort((a, b) => {
        const delta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortDirection === 'desc' ? -delta : delta;
      });
  }, [orders, statusFilter, query, sortDirection]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase text-blue-700">Cuenta</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Mis pedidos</h1>
          <p className="mt-2 text-sm text-slate-600">Consulta tus compras y sigue el estado de tus pedidos.</p>
        </div>
        <Link href="/tiendas" className="text-sm font-bold text-blue-700 hover:underline">Seguir comprando</Link>
      </div>

      <div className="mb-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-full w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Total</p><p className="mt-3 text-2xl font-black text-slate-900">{stats.total}</p></div>
        <div className="h-full w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Pendientes</p><p className="mt-3 text-2xl font-black text-slate-900">{stats.pendientes}</p></div>
        <div className="h-full w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Preparación</p><p className="mt-3 text-2xl font-black text-slate-900">{stats.enPreparacion}</p></div>
        <div className="h-full w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">Completados</p><p className="mt-3 text-2xl font-black text-slate-900">{stats.completados}</p></div>
      </div>

      <div className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <label className="text-sm font-medium text-slate-700">
          Buscar por número
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="PG-..."
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Estado
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="en_preparacion">En preparación</option>
            <option value="listo">Listo</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Orden
          <select
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as 'desc' | 'asc')}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="desc">Más reciente</option>
            <option value="asc">Más antiguo</option>
          </select>
        </label>
      </div>

      {loading && <p className="py-10 text-center text-sm text-slate-500">Cargando pedidos...</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {!loading && !error && filteredOrders.length === 0 && (
        <div className="border-y border-slate-200 py-12 text-center">
          <p className="font-semibold text-slate-700">Todavía no tienes pedidos con esos filtros.</p>
          <Link href="/tiendas" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white">Explorar tiendas</Link>
        </div>
      )}
      {!loading && filteredOrders.length > 0 && (
        <div className="overflow-x-auto border-y border-slate-200">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-bold">Número</th>
                <th className="px-4 py-3 font-bold">Tienda</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Productos</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold">Pago</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="bg-white">
                  <td className="px-4 py-4 font-bold text-slate-900">{order.numero_pedido}</td>
                  <td className="px-4 py-4 text-slate-700">{order.tienda?.nombre_comercio || 'Tienda'}</td>
                  <td className="px-4 py-4 text-slate-600">{new Date(order.created_at).toLocaleDateString('es-PY')}</td>
                  <td className="px-4 py-4 text-slate-600">{order.total > 0 ? 'Pedido' : 'Sin detalle'}</td>
                  <td className="px-4 py-4 font-semibold text-slate-800">Gs. {Number(order.total).toLocaleString('es-PY')}</td>
                  <td className="px-4 py-4"><span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-700">{getOrderStateLabel(order.estado)}</span></td>
                  <td className="px-4 py-4 capitalize text-slate-700">{order.estado_pago}</td>
                  <td className="px-4 py-4 text-right"><Link href={`/pedidos/${order.id}`} className="font-bold text-blue-700 hover:underline">Ver detalle</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}