/**
 * [PÁGINA] Página /comercios: mapa de comercios del Guairá con filtros por municipio, rubro y distancia.
 * La lista inicial se genera en el servidor (y se regenera cada 60 s); los filtros consultan PostGIS.
 */
import type { Metadata } from 'next';
import ShopsMapExplorer from '@/frontend/components/shops/ShopsMapExplorer';
import { getShopsForMap } from '@/backend/catalog/shops';
import { getProductDistricts } from '@/backend/catalog/products';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Mapa de comercios del Guairá',
  description: 'Encuentra comercios cercanos por municipio, rubro y distancia.',
};

export default async function ComerciosPage() {
  const [shops, districts] = await Promise.all([getShopsForMap(), getProductDistricts()]);
  const categories = [...new Set(shops.map((shop) => shop.categoria_principal).filter((name): name is string => Boolean(name)))]
    .sort((left, right) => left.localeCompare(right, 'es'));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      {/* Conexión anticipada a los servidores de mosaicos del mapa (React los sube al <head>) */}
      <link rel="preconnect" href="https://a.tile.openstreetmap.org" crossOrigin="" />
      <link rel="preconnect" href="https://b.tile.openstreetmap.org" crossOrigin="" />
      <link rel="preconnect" href="https://c.tile.openstreetmap.org" crossOrigin="" />
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Geolocalización</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Mapa de comercios</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Encuentra comercios del Guairá por municipio, rubro y cercanía. Toca un marcador para ver la tienda.
          </p>
        </div>
        <ShopsMapExplorer initialShops={shops} districts={districts} categories={categories} />
      </div>
    </main>
  );
}
