'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import FavoriteToggle from '@/components/common/FavoriteToggle';
import { haversineDistanceKm } from '@/lib/geolocation';
import type { FeaturedProduct, ProductDistrict } from '@/services/products.service';

const LocationPicker = dynamic(() => import('@/components/ui/LocationPicker'), {
  ssr: false,
  loading: () => <p role="status" className="py-8 text-center text-sm text-slate-500">Cargando mapa…</p>,
});

type SearchLocation = { latitude: number; longitude: number };
type DistanceLimit = 'all' | '1' | '5' | '10';

function productPath(product: FeaturedProduct) {
  const slug = product.tienda?.slug;
  return slug ? `/tienda/${encodeURIComponent(slug)}#product-${product.id}` : '/';
}

export default function ProductDirectory({ products, districts }: { products: FeaturedProduct[]; districts: ProductDistrict[] }) {
  const [location, setLocation] = useState<SearchLocation | null>(null);
  const [distanceLimit, setDistanceLimit] = useState<DistanceLimit>('5');
  const [districtId, setDistrictId] = useState('all');
  const [showMap, setShowMap] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const manualLocationSelected = useRef(false);

  useEffect(() => {
    let active = true;
    if (!navigator.geolocation) {
      setLocationStatus('Tu navegador no permite obtener ubicación automáticamente; puedes elegirla en el mapa.');
      return () => { active = false; };
    }

    setLocationStatus('Detectando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!active || manualLocationSelected.current) return;
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationStatus('Ubicación detectada. Los productos cercanos aparecen primero.');
      },
      () => {
        if (!active || manualLocationSelected.current) return;
        setLocation(null);
        setLocationStatus('No se pudo obtener tu ubicación; se mantiene el orden original. Puedes elegirla en el mapa.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );

    return () => { active = false; };
  }, []);

  const { filteredProducts, hasProductsInSelectedArea } = useMemo(() => {
    const located = products.map((product, originalIndex) => {
      const latitude = product.tienda?.latitud;
      const longitude = product.tienda?.longitud;
      const distanceKm = location && Number.isFinite(latitude) && Number.isFinite(longitude)
        ? haversineDistanceKm(location.latitude, location.longitude, latitude!, longitude!)
        : null;
      return { product, originalIndex, distanceKm };
    });

    const maximumDistance = distanceLimit === 'all' ? null : Number(distanceLimit);
    const matchesDistrict = (product: FeaturedProduct) => districtId === 'all' || String(product.tienda?.distrito_id ?? '') === districtId;
    const matchesDistance = (distanceKm: number | null) => !location || maximumDistance === null || (distanceKm !== null && distanceKm <= maximumDistance);
    const hasProductsInSelectedArea = located.some(({ product, distanceKm }) => matchesDistrict(product) && matchesDistance(distanceKm));
    let areaProducts = located.filter(({ product, distanceKm }) => matchesDistrict(product) && matchesDistance(distanceKm));

    if (location) {
      areaProducts = [...areaProducts].sort((left, right) => {
        if (left.distanceKm === null) return right.distanceKm === null ? left.originalIndex - right.originalIndex : 1;
        if (right.distanceKm === null) return -1;
        return left.distanceKm - right.distanceKm;
      });
    }

    return { filteredProducts: areaProducts, hasProductsInSelectedArea };
  }, [products, location, distanceLimit, districtId]);

  const formatDistance = (distanceKm: number | null) => {
    if (distanceKm === null) return 'Distancia no disponible';
    return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
  };

  return (
    <section aria-label="Catálogo de productos">
      <div className="mb-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Distrito</span>
            <select aria-label="Filtrar productos por distrito" value={districtId} onChange={(event) => setDistrictId(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100">
              <option value="all">Todos los distritos</option>
              {districts.map((district) => <option key={district.id} value={String(district.id)}>{district.nombre}</option>)}
            </select>
          </label>
          <p className="text-xs font-semibold text-slate-500">{filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setShowMap((visible) => !visible)} aria-expanded={showMap} aria-controls="product-search-location-map" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-900 transition hover:bg-sky-100">
              <span aria-hidden="true">📍</span>{showMap ? 'Ocultar mapa' : location ? 'Cambiar ubicación' : 'Elegir ubicación en mapa'}
            </button>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Radio</span>
              <select aria-label="Radio de búsqueda de productos" value={distanceLimit} onChange={(event) => setDistanceLimit(event.target.value as DistanceLimit)} disabled={!location} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-400">
                <option value="1">1 km</option><option value="5">5 km</option><option value="10">10 km</option><option value="all">Todo Guairá</option>
              </select>
            </label>
            {location && <p className="text-xs text-slate-500">Ubicación: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p>}
            {locationStatus && <p role="status" aria-live="polite" className="text-xs text-slate-500">{locationStatus}</p>}
          </div>
          {showMap && <div id="product-search-location-map" className="mt-4"><LocationPicker latInicial={location?.latitude} lngInicial={location?.longitude} onLocationChange={(latitude, longitude) => { manualLocationSelected.current = true; setLocation({ latitude, longitude }); setLocationStatus('Ubicación seleccionada en el mapa.'); }} /></div>}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
          {!hasProductsInSelectedArea && districtId !== 'all'
            ? `No hay productos disponibles en el distrito seleccionado${location && distanceLimit !== 'all' ? ` dentro de ${distanceLimit} km` : ''}.`
            : location && !hasProductsInSelectedArea
              ? distanceLimit === 'all' ? 'No hay productos en esta ubicación.' : `No hay productos en esta ubicación dentro de ${distanceLimit} km.`
            : 'No encontramos productos con esa búsqueda.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(({ product, distanceKm }) => (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-slate-100">
                {product.imagen_url ? <Image src={product.imagen_url} alt={product.titulo} fill unoptimized className="object-cover" /> : <div className="flex h-full items-center justify-center text-4xl text-slate-300">□</div>}
                <FavoriteToggle kind="producto" targetId={product.id || ''} className="absolute right-3 top-3 z-10" />
              </div>
              <div className="p-4">
                <p className="truncate text-xs font-semibold text-slate-500">{product.tienda?.nombre_comercio || 'Comercio local'}</p>
                <h2 className="mt-1 truncate text-base font-bold text-slate-900">{product.titulo}</h2>
                {product.descripcion && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{product.descripcion}</p>}
                {location && <p className="mt-2 text-xs font-bold text-sky-700">📍 {formatDistance(distanceKm)}</p>}
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <span className="text-sm font-extrabold text-sky-700">{Number(product.precio_oferta || product.precio_gs || 0).toLocaleString('es-PY')} Gs.</span>
                  <Link href={productPath(product)} className="text-xs font-bold text-slate-600 hover:text-sky-700">Ver producto →</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}