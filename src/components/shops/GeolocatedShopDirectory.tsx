'use client';

import { useMemo, useState } from 'react';
import ShopCard from '@/components/shops/ShopCard';
import { haversineDistanceKm } from '@/lib/geolocation';

type Shop = {
  id: string;
  slug?: string | null;
  nombre_comercio?: string | null;
  descripcion?: string | null;
  categoria_principal?: string | null;
  logo_url?: string | null;
  portada_url?: string | null;
  verificada?: boolean;
  whatsapp?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  distritos?: { nombre?: string | null } | null;
};

type DistanceLimit = 'all' | '1' | '5' | '10';

type LocatedShop = {
  shop: Shop;
  originalIndex: number;
  distanceKm: number | null;
};

function getPositionErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return 'No se concedió permiso. Se mantiene el orden original.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'No se pudo determinar tu ubicación. Se mantiene el orden original.';
  if (error.code === error.TIMEOUT) return 'La solicitud de ubicación tardó demasiado. Se mantiene el orden original.';
  return 'No se pudo obtener tu ubicación. Se mantiene el orden original.';
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) return 'Distancia no disponible';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export default function GeolocatedShopDirectory({ shops }: { shops: Shop[] }) {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceLimit, setDistanceLimit] = useState<DistanceLimit>('all');
  const [locating, setLocating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const sortedShops = useMemo(() => {
    const located: LocatedShop[] = shops.map((shop, originalIndex) => {
      const hasCoordinates = Number.isFinite(shop.latitud) && Number.isFinite(shop.longitud);
      return {
        shop,
        originalIndex,
        distanceKm: location && hasCoordinates
          ? haversineDistanceKm(location.latitude, location.longitude, shop.latitud!, shop.longitud!)
          : null,
      };
    });

    if (!location) return located;

    const ordered = [...located].sort((left, right) => {
      if (left.distanceKm === null) return right.distanceKm === null ? left.originalIndex - right.originalIndex : 1;
      if (right.distanceKm === null) return -1;
      return left.distanceKm - right.distanceKm;
    });

    if (distanceLimit === 'all') return ordered;
    const maximumDistance = Number(distanceLimit);
    return ordered.filter((item) => item.distanceKm !== null && item.distanceKm <= maximumDistance);
  }, [shops, location, distanceLimit]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocation(null);
      setDistanceLimit('all');
      setStatusMessage('Tu navegador no ofrece geolocalización. Se mantiene el orden original.');
      return;
    }

    setLocating(true);
    setStatusMessage('Solicitando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setStatusMessage('Tiendas ordenadas por cercanía.');
        setLocating(false);
      },
      (error) => {
        setLocation(null);
        setDistanceLimit('all');
        setStatusMessage(getPositionErrorMessage(error));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  return (
    <section aria-label="Tiendas ordenadas por cercanía">
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={requestLocation} disabled={locating} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-900 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-60">
            <span aria-hidden="true">📍</span>{locating ? 'Buscando ubicación…' : 'Usar mi ubicación actual'}
          </button>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span>Radio</span>
            <select aria-label="Radio de búsqueda" value={distanceLimit} onChange={(event) => setDistanceLimit(event.target.value as DistanceLimit)} disabled={!location} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 disabled:bg-slate-50 disabled:text-slate-400">
              <option value="1">1 km</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="all">Todo Guairá</option>
            </select>
          </label>
        </div>
        {statusMessage && <p role="status" aria-live="polite" className="text-xs text-slate-500">{statusMessage}</p>}
      </div>

      {sortedShops.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No hay tiendas dentro de ese radio.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {sortedShops.map(({ shop, distanceKm }) => (
            <ShopCard
              key={shop.id}
              id={shop.id}
              slug={shop.slug || undefined}
              nombreComercio={shop.nombre_comercio || undefined}
              descripcion={shop.descripcion || undefined}
              categoriaPrincipal={shop.categoria_principal || undefined}
              logoUrl={shop.logo_url || undefined}
              bannerUrl={shop.portada_url || undefined}
              verificada={shop.verificada}
              whatsapp={shop.whatsapp || undefined}
              distrito={shop.distritos?.nombre || undefined}
              distanceLabel={location ? formatDistance(distanceKm) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}