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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    getVendorStores()
      .then((result) => { if (current) setStores(result); })
      .catch((cause) => { if (current) setError(userFacingError(cause, 'No se pudieron cargar tus tiendas.')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reloadKey]);

  const activeCount = stores.filter((store) => ['activa', 'activo'].includes(store.estado.trim().toLowerCase())).length;
  const pendingCount = stores.filter((store) => store.estado.trim().toLowerCase() === 'pendiente').length;

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Gestión comercial</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Mis tiendas</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600">Consulta el estado, la ubicación y los datos de los comercios vinculados a tu cuenta.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/comerciante" className="text-sm font-bold text-blue-700 hover:underline">Volver al resumen</Link>
          <Link href="/comerciante/tienda" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            {stores.length ? 'Editar comercio' : 'Configurar comercio'}
          </Link>
        </div>
      </header>

      {loading ? (
        <section aria-label="Cargando resumen de tiendas" className="mb-6 grid grid-cols-1 divide-y divide-slate-100 border-y border-slate-200 bg-white sm:grid-cols-3 sm:divide-y-0">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="px-5 py-4 sm:border-r sm:border-slate-100 sm:last:border-r-0"><div className="h-3 w-20 animate-pulse rounded bg-slate-200" /><div className="mt-3 h-6 w-12 animate-pulse rounded bg-slate-100" /></div>)}
        </section>
      ) : !error && (
        <section aria-label="Resumen de tiendas" className="mb-6 grid grid-cols-1 divide-y divide-slate-200 border-y border-slate-200 bg-white sm:grid-cols-3 sm:divide-y-0">
          {[
            { label: 'Comercios asociados', value: stores.length, color: 'text-slate-900' },
            { label: 'Activos', value: activeCount, color: 'text-emerald-700' },
            { label: 'En revisión', value: pendingCount, color: 'text-amber-700' },
          ].map((metric, index) => (
            <div key={metric.label} className={`px-4 py-4 sm:px-6 ${index < 2 ? 'border-b border-slate-200 sm:border-b-0 sm:border-r' : ''}`}>
              <p className="text-xs font-bold text-slate-500">{metric.label}</p>
              <p className={`mt-1 text-2xl font-black tabular-nums ${metric.color}`}>{metric.value.toLocaleString('es-PY')}</p>
            </div>
          ))}
        </section>
      )}

      {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>{error}</span><button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-bold text-rose-900 underline decoration-rose-300 underline-offset-2">Reintentar</button></div>}
      {loading && <div className="grid gap-4"><div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" /></div>}
      {!loading && !error && stores.length === 0 && <section className="border-y border-slate-200 bg-white px-6 py-12 text-center sm:px-10"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Tu espacio comercial</p><h2 className="mt-2 text-xl font-black text-slate-900">Aún no tienes comercios asociados</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Configura tu comercio para publicar productos y empezar a recibir pedidos.</p><Link href="/comerciante/tienda" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700">Configurar comercio</Link></section>}

      {!loading && stores.length > 0 && <>
        <div className={`grid gap-4 ${stores.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          {stores.map((store) => (
            <article key={store.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Comercio</p>
                  <h2 className="mt-1 break-words text-xl font-black text-slate-900">{store.nombre_comercio}</h2>
                  {store.slug && <p className="mt-1 break-all text-sm text-slate-500">/{store.slug}</p>}
                </div>
                <span className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold capitalize ${['activa', 'activo'].includes(store.estado.trim().toLowerCase()) ? 'bg-emerald-50 text-emerald-800' : store.estado.trim().toLowerCase() === 'pendiente' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{storeStatus(store.estado)}
                </span>
              </div>
              <dl className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                <div><dt className="text-xs font-semibold text-slate-500">Distrito</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{store.distrito_nombre || 'No especificado'}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Dirección</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{store.direccion_texto || 'No especificada'}</dd></div>
                {store.creado_en && <div><dt className="text-xs font-semibold text-slate-500">Fecha de registro</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{new Date(store.creado_en).toLocaleDateString('es-PY')}</dd></div>}
                {store.latitud !== null && store.longitud !== null && <div><dt className="text-xs font-semibold text-slate-500">Ubicación</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{store.latitud}, {store.longitud}</dd></div>}
              </dl>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {store.slug ? <Link href={`/tienda/${store.slug}`} className="text-sm font-bold text-blue-700 hover:underline">Ver tienda pública</Link> : <span className="text-sm text-slate-500">Aún no hay enlace público</span>}
                  {store.latitud !== null && store.longitud !== null && <a href={`https://www.google.com/maps/search/?api=1&query=${store.latitud},${store.longitud}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-700 hover:text-blue-700">Abrir ubicación</a>}
                </div>
                <Link href="/comerciante/tienda" className="text-sm font-bold text-slate-700 hover:text-blue-700">Editar datos</Link>
              </div>
            </article>
          ))}
        </div>
      </>}
    </main>
  );
}