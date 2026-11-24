'use client';

/**
 * [PÁGINA] Página /vendedor/clientes: clientes que compraron en las tiendas del comerciante, con su historial resumido.
 * Solo muestra el nombre y las compras hechas en sus tiendas (los datos de entrega están en cada pedido).
 */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { userFacingError } from '@/shared/lib/user-facing-error';

type Client = { clave: number; nombre: string; pedidos: number; cancelados: number; total: number; primera: string; ultima: string };

const currency = (value: number) => `Gs. ${Math.round(value).toLocaleString('es-PY')}`;
const date = (value: string) => new Date(value).toLocaleDateString('es-PY');

export default function VendorClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/vendedor/clientes', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { clientes?: Client[]; error?: string };
        if (!response.ok) throw new Error(body.error || 'No se pudieron cargar los clientes.');
        if (active) setClients(body.clientes ?? []);
      })
      .catch((cause) => { if (active) setError(userFacingError(cause, 'No se pudieron cargar los clientes.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? clients.filter((client) => client.nombre.toLowerCase().includes(term)) : clients;
  }, [clients, search]);
  const cards: Array<[string, number]> = [
    ['Clientes', clients.length],
    ['Compraron más de una vez', clients.filter((client) => client.pedidos - client.cancelados > 1).length],
    ['Pedidos recibidos', clients.reduce((sum, client) => sum + client.pedidos, 0)],
  ];

  return (
    <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Mi negocio</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Clientes de mi tienda</h1>
          <p className="mt-2 text-sm text-slate-600">Personas que hicieron pedidos en tus tiendas. Los datos de entrega se ven solo en cada pedido.</p>
        </div>
        <Link href="/comerciante" className="text-sm font-bold text-primary-700 hover:underline">Volver al resumen</Link>
      </header>

      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {loading && <div className="mb-5 h-20 animate-pulse rounded-2xl bg-slate-100" />}

      {!loading && !error && <>
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {cards.map(([label, value]) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p></article>
          ))}
        </div>
        <label className="mb-4 block text-xs font-semibold text-slate-600">Buscar cliente
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre del cliente" className="mt-1 block w-full max-w-sm rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800" />
        </label>
        {visible.length === 0
          ? <p className="border-y border-slate-200 py-10 text-center text-sm text-slate-600">{clients.length === 0 ? 'Todavía no recibiste pedidos.' : 'Ningún cliente coincide con la búsqueda.'}</p>
          : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Pedidos</th><th className="px-4 py-3">Cancelados</th><th className="px-4 py-3">Primera compra</th><th className="px-4 py-3">Última compra</th><th className="px-4 py-3 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{visible.map((client) => (
                <tr key={client.clave}><td className="px-4 py-3 font-semibold text-slate-800">{client.nombre}</td><td className="px-4 py-3">{client.pedidos}</td><td className="px-4 py-3">{client.cancelados}</td><td className="px-4 py-3">{date(client.primera)}</td><td className="px-4 py-3">{date(client.ultima)}</td><td className="px-4 py-3 text-right">{currency(client.total)}</td></tr>
              ))}</tbody>
            </table>
          </div>}
      </>}
    </main>
  );
}
