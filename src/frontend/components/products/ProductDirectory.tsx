'use client';

/**
 * [FRONTEND] Directorio de productos de /tiendas: búsqueda, filtro por distrito y orden por cercanía (mapa opcional).
 *
 * Ubicación: solo con consentimiento (botón + explicación) o eligiéndola en el mapa; nunca automática.
 * Distancias: las calcula PostGIS en la base (tiendas_cercanas); sin conexión, Haversine en el navegador.
 */
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import FavoriteToggle from '@/frontend/components/common/FavoriteToggle';
import PriceTag from '@/frontend/components/products/PriceTag';
import { getLowStock } from '@/shared/lib/product-pricing';
import { haversineDistanceKm } from '@/frontend/lib/geolocation';
import { LOCATION_PURPOSE, getStoredLocation, requestLocationWithConsent, saveLocation } from '@/frontend/lib/location-consent';
import { fetchNearbyShops } from '@/frontend/services/shops-map.service';
import type { FeaturedProduct, ProductDistrict } from '@/shared/types/catalog';

const LocationPicker = dynamic(() => import('@/frontend/components/ui/LocationPicker'), {
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
  /** Distancia (km) a cada comercio calculada por PostGIS; vacío = usar Haversine local. */
  const [shopDistances, setShopDistances] = useState<Map<string, number>>(new Map());

  // Reutiliza una ubicación ya consentida (vigente 30 min); no pide permiso sola.
  useEffect(() => {
    const stored = getStoredLocation();
    if (stored) {
      setLocation(stored);
      setLocationStatus('Usando la ubicación que indicaste. Los productos cercanos aparecen primero.');
    }
  }, []);

  // Distancias reales desde la base de datos (PostGIS) cuando hay ubicación
  useEffect(() => {
    if (!location) return;
    let active = true;
    fetchNearbyShops({ location, radiusKm: null, districtId: null, category: null })
      .then((shops) => {
        if (!active) return;
        setShopDistances(new Map(shops.filter((shop) => shop.distancia_km != null).map((shop) => [shop.id, Number(shop.distancia_km)])));
      })
      .catch(() => { if (active) setShopDistances(new Map()); });
    return () => { active = false; };
  }, [location]);

  const askForLocation = async () => {
    setLocationStatus('Buscando tu ubicación…');
    try {
      setLocation(await requestLocationWithConsent());
      setLocationStatus('Ubicación detectada. Los productos cercanos aparecen primero.');
    } catch (error) {
      setLocationStatus(error instanceof Error ? error.message : 'No se pudo obtener tu ubicación.');
    }
  };

  const { filteredProducts, hasProductsInSelectedArea } = useMemo(() => {
    const located = products.map((product, originalIndex) => {
      const latitude = product.tienda?.latitud;
      const longitude = product.tienda?.longitud;
      const postgisKm = shopDistances.get(product.tienda_id);
      const distanceKm = !location ? null
        : postgisKm !== undefined ? postgisKm
          : Number.isFinite(latitude) && Number.isFinite(longitude)
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
  }, [products, location, distanceLimit, districtId, shopDistances]);

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
            <select aria-label="Filtrar productos por distrito" value={districtId} onChange={(event) => setDistrictId(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-100">
              <option value="all">Todos los distritos</option>
              {districts.map((district) => <option key={district.id} value={String(district.id)}>{district.nombre}</option>)}
            </select>
          </label>
          <p className="text-xs font-semibold text-slate-500">{filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {!location && <p className="mb-3 text-xs leading-5 text-slate-500">{LOCATION_PURPOSE}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {!location && (
              <button type="button" onClick={() => void askForLocation()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-800">
                <span aria-hidden="true">🛰️</span>Usar mi ubicación
              </button>
            )}
            <button type="button" onClick={() => setShowMap((visible) => !visible)} aria-expanded={showMap} aria-controls="product-search-location-map" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-sm font-bold text-accent-900 transition hover:bg-accent-100">
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
          {showMap && <div id="product-search-location-map" className="mt-4"><LocationPicker latInicial={location?.latitude} lngInicial={location?.longitude} onLocationChange={(latitude, longitude) => { saveLocation({ latitude, longitude }); setLocation({ latitude, longitude }); setLocationStatus('Ubicación seleccionada en el mapa.'); }} /></div>}
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
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(({ product, distanceKm }) => (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[4/3] bg-slate-100">
                {product.imagen_url ? <Image src={product.imagen_url} alt={product.titulo} fill unoptimized className="object-cover" /> : <div className="flex h-full items-center justify-center text-4xl text-slate-300">□</div>}
                <FavoriteToggle kind="producto" targetId={product.id || ''} className="absolute right-3 top-3 z-10" />
              </div>
              <div className="p-3 sm:p-4">
                <p className="truncate text-xs font-semibold text-slate-500">{product.tienda?.nombre_comercio || 'Comercio local'}</p>
                <h2 className="mt-1 truncate text-sm font-bold text-slate-900 sm:text-base">{product.titulo}</h2>
                {product.descripcion && <p className="mt-1 line-clamp-1 text-xs leading-5 text-slate-500 sm:line-clamp-2">{product.descripcion}</p>}
                {getLowStock(product.stock, product.stock_minimo) !== null && <p className="mt-2 text-[10px] font-extrabold text-amber-700">🔥 ¡Últimas {getLowStock(product.stock, product.stock_minimo)} unidades!</p>}
                {location && <p className="mt-2 text-xs font-bold text-accent-700">📍 {formatDistance(distanceKm)}</p>}
                <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-2 sm:mt-4 sm:pt-3">
                  <PriceTag price={product.precio_gs} offer={product.precio_oferta} size="sm" className="text-accent-700" />
                  <Link href={productPath(product)} className="-my-2 inline-flex min-h-10 items-center text-xs font-bold text-slate-600 hover:text-accent-700">Ver producto →</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}