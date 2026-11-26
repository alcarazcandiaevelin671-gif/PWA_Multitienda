'use client';

/**
 * [FRONTEND] Explorador geográfico de comercios (/comercios): mapa + filtros + lista por cercanía.
 *
 * Filtros: municipio (distrito), rubro (categoría) y radio en km desde el usuario.
 * Ubicación: solo con consentimiento explícito (botón + explicación), por GPS o tocando el mapa.
 * Distancias: PostGIS en la base (tiendas_cercanas); sin conexión, Haversine en el navegador.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import ShopCard from '@/frontend/components/shops/ShopCard';
import {
  LOCATION_PURPOSE,
  forgetLocation,
  getStoredLocation,
  requestLocationWithConsent,
  saveLocation,
  type Coordinates,
} from '@/frontend/lib/location-consent';
import { fetchNearbyShops, filterShopsOffline, type NearbyShop } from '@/frontend/services/shops-map.service';

const ShopsMap = dynamic(() => import('@/frontend/components/shops/ShopsMap'), {
  ssr: false,
  loading: () => <div className="flex h-[340px] sm:h-[420px] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">Cargando mapa…</div>,
});

const RADIUS_OPTIONS = [
  { value: '1', label: '1 km' },
  { value: '5', label: '5 km' },
  { value: '10', label: '10 km' },
  { value: '25', label: '25 km' },
  { value: 'all', label: 'Todo Guairá' },
];

const formatKm = (km: number | null) => (km == null ? undefined : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

type Props = {
  initialShops: NearbyShop[];
  districts: Array<{ id: number; nombre: string }>;
  categories: string[];
};

export default function ShopsMapExplorer({ initialShops, districts, categories }: Props) {
  const [shops, setShops] = useState<NearbyShop[]>(initialShops);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [districtId, setDistrictId] = useState('');
  const [category, setCategory] = useState('');
  const [radius, setRadius] = useState('all');
  const [pickMode, setPickMode] = useState(false);
  const [selected, setSelected] = useState<NearbyShop | null>(null);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState<'postgis' | 'offline'>('postgis');
  const [loading, setLoading] = useState(false);
  const mapSection = useRef<HTMLDivElement>(null);

  // Ubicación consentida antes (vigente 30 min): se reutiliza sin volver a preguntar.
  useEffect(() => {
    const sync = () => setLocation(getStoredLocation());
    sync();
    window.addEventListener('pg-ubicacion', sync);
    return () => window.removeEventListener('pg-ubicacion', sync);
  }, []);

  const filters = useMemo(() => ({
    location,
    radiusKm: radius === 'all' ? null : Number(radius),
    districtId: districtId ? Number(districtId) : null,
    category: category || null,
  }), [location, radius, districtId, category]);

  // Consulta espacial en la base cada vez que cambia un filtro
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchNearbyShops(filters)
      .then((result) => { if (active) { setShops(result); setSource('postgis'); } })
      .catch(() => { if (active) { setShops(filterShopsOffline(initialShops, filters)); setSource('offline'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, initialShops]);

  const activateGps = useCallback(async () => {
    setStatus('Buscando tu ubicación…');
    try {
      const coordinates = await requestLocationWithConsent();
      setLocation(coordinates);
      setStatus('Comercios ordenados por cercanía.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo obtener tu ubicación.');
    }
  }, []);

  const pickLocation = useCallback((lat: number, lng: number) => {
    const coordinates = { latitude: lat, longitude: lng };
    saveLocation(coordinates);
    setLocation(coordinates);
    setPickMode(false);
    setStatus('Ubicación elegida en el mapa.');
  }, []);

  const showOnMap = (shop: NearbyShop) => {
    setSelected(shop);
    mapSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section aria-label="Mapa y directorio de comercios" className="space-y-5">
      {/* Consentimiento de ubicación */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-bold">📍 Tu ubicación, con tu permiso</p>
        <p className="mt-1 text-xs leading-5">{LOCATION_PURPOSE}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void activateGps()} className="min-h-10 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-800">
            Usar mi ubicación (GPS)
          </button>
          <button type="button" onClick={() => setPickMode((value) => !value)} aria-pressed={pickMode} className={`min-h-10 rounded-xl border px-4 text-xs font-bold ${pickMode ? 'border-blue-700 bg-white text-blue-800' : 'border-blue-300 text-blue-800 hover:bg-white'}`}>
            {pickMode ? 'Toca el mapa para elegir…' : 'Elegir en el mapa'}
          </button>
          {location && (
            <button type="button" onClick={() => { forgetLocation(); setLocation(null); setRadius('all'); setStatus('Ubicación borrada de este dispositivo.'); }} className="min-h-10 rounded-xl px-3 text-xs font-bold text-blue-800 underline">
              Olvidar mi ubicación
            </button>
          )}
        </div>
        {status && <p role="status" aria-live="polite" className="mt-2 text-xs font-semibold">{status}</p>}
      </div>

      {/* Filtros */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">Municipio
          <select value={districtId} onChange={(event) => setDistrictId(event.target.value)} className="mt-1 w-full min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800">
            <option value="">Todos los municipios</option>
            {districts.map((district) => <option key={district.id} value={district.id}>{district.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Rubro
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800">
            <option value="">Todos los rubros</option>
            {categories.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">Distancia máxima
          <select value={radius} onChange={(event) => setRadius(event.target.value)} disabled={!location} title={location ? undefined : 'Indica tu ubicación para filtrar por distancia'} className="mt-1 w-full min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-400">
            {RADIUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {/* Mapa */}
      <div ref={mapSection} className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
        <ShopsMap
          shops={shops}
          userLocation={location}
          radiusKm={filters.radiusKm}
          selectedShop={selected}
          pickMode={pickMode}
          onPickLocation={pickLocation}
        />
        <p className="px-2 pt-2 text-[11px] text-slate-500">
          {loading ? 'Actualizando…' : `${shops.length} ${shops.length === 1 ? 'comercio' : 'comercios'}`}
          {' · '}
          {source === 'postgis' ? 'Distancias calculadas en la base de datos con PostGIS.' : 'Sin conexión: distancias calculadas en el dispositivo.'}
        </p>
      </div>

      {/* Lista ordenada por cercanía */}
      {shops.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No hay comercios con esos filtros{filters.radiusKm ? ` dentro de ${filters.radiusKm} km` : ''}.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {shops.map((shop) => (
            <div key={shop.id} className="flex flex-col gap-2">
              <ShopCard
                id={shop.id}
                slug={shop.slug || undefined}
                nombreComercio={shop.nombre_comercio || undefined}
                descripcion={shop.descripcion || undefined}
                categoriaPrincipal={shop.categoria_principal || undefined}
                logoUrl={shop.logo_url || undefined}
                bannerUrl={shop.portada_url || undefined}
                verificada
                whatsapp={shop.whatsapp || undefined}
                distrito={shop.distrito || undefined}
                distanceLabel={location ? formatKm(shop.distancia_km) : undefined}
              />
              <button type="button" onClick={() => showOnMap(shop)} disabled={shop.latitud == null} className="rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                🗺️ Ver en el mapa
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
