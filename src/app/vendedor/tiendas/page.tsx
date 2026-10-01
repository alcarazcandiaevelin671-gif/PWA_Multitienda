'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getVendorStores, type VendorStoreDetail } from '@/services/vendor-dashboard.service';
import { userFacingError } from '@/lib/user-facing-error';

const storeStatus = (value: string) => value.replaceAll('_', ' ');

export default function VendorStoresPage() {
  const [stores, setStores] = useState<VendorStoreDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    getVendorStores()
      .then((result) => { if (current) setStores(result); })
      .catch((cause) => { if (current) setError(userFacingError(cause, 'No se pudieron cargar tus tiendas.')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Comerciante</p><h1 className="mt-1 text-3xl font-black text-slate-900">Mis tiendas</h1><p className="mt-2 text-sm text-slate-600">Información de los comercios asociados a tu cuenta.</p></div>
        <Link href="/vendedor" className="text-sm font-bold text-blue-700 hover:underline">Volver al resumen</Link>
      </header>

      {error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {loading && <div className="grid gap-4 md:grid-cols-2"><div className="h-52 animate-pulse rounded-2xl bg-white" /><div className="h-52 animate-pulse rounded-2xl bg-white" /></div>}
      {!loading && !error && stores.length === 0 && <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h2 className="text-lg font-black text-slate-900">No tienes tiendas registradas</h2><p className="mt-2 text-sm text-slate-600">Registra tu comercio para comenzar a administrar el catálogo.</p><Link href="/comerciante/tienda" className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Registrar tienda</Link></section>}

      {!loading && stores.length > 0 && <>
        {stores.length === 1 && <div className="mb-5 flex justify-end"><Link href="/comerciante/dashboard" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Editar mi tienda</Link></div>}
        <div className="grid gap-4 lg:grid-cols-2">
          {stores.map((store) => (
            <article key={store.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5">
                <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Comercio</p><h2 className="mt-1 break-words text-xl font-black text-slate-900">{store.nombre_comercio}</h2>{store.slug && <p className="mt-1 break-all text-xs text-slate-500">/{store.slug}</p>}</div>
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold capitalize text-slate-700">{storeStatus(store.estado)}</span>
              </div>
              <dl className="grid gap-4 p-5 sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-slate-500">Distrito</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{store.distrito_nombre || 'No especificado'}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Dirección</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{store.direccion_texto || 'No especificada'}</dd></div>
                {store.creado_en && <div><dt className="text-xs font-semibold text-slate-500">Registrada</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{new Date(store.creado_en).toLocaleDateString('es-PY')}</dd></div>}
                {store.latitud !== null && store.longitud !== null && <div><dt className="text-xs font-semibold text-slate-500">Coordenadas</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-800">{store.latitud}, {store.longitud}</dd></div>}
              </dl>
              <div className="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
                {store.slug ? <Link href={`/tienda/${store.slug}`} className="text-sm font-bold text-blue-700 hover:underline">Ver tienda</Link> : <span className="text-sm text-slate-500">La tienda aún no tiene enlace público.</span>}
                {stores.length > 1 && <span className="text-xs text-slate-500">El editor actual administra una tienda por vez.</span>}
              </div>
            </article>
          ))}
        </div>
      </>}
    </main>
  );
}