'use client';

/**
 * [FRONTEND] Mapa de comercios del Guairá (Leaflet + OpenStreetMap: gratuito, sin clave de API).
 *
 * - Un marcador por comercio, con el ícono de su rubro.
 * - Ventana emergente con distrito, distancia (calculada por PostGIS), cantidad de productos,
 *   enlace a la tienda y a su WhatsApp.
 * - Marcador del usuario y círculo del radio elegido.
 * - Modo "elegir en el mapa": un clic fija la ubicación (alternativa al GPS).
 *
 * Se carga solo en el navegador (Leaflet necesita `window`): importarlo con next/dynamic y ssr: false.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { NearbyShop } from '@/frontend/services/shops-map.service';

/** Centro del Departamento de Guairá (Villarrica). */
export const GUAIRA_CENTER: [number, number] = [-25.7806, -56.4486];

const CATEGORY_ICONS: Array<[RegExp, string, string]> = [
  [/alimento|gastronom|comida|pizza|panader/i, '🍽️', '#ea580c'],
  [/artesan|regalo/i, '🧶', '#a21caf'],
  [/electr|tecnolog/i, '🔌', '#2563eb'],
  [/super|almac|despensa/i, '🛒', '#16a34a'],
  [/ferret|constru/i, '🔧', '#64748b'],
  [/servicio/i, '🛠️', '#0891b2'],
  [/ropa|moda|calzado/i, '👗', '#db2777'],
];

function categoryStyle(category: string | null) {
  const match = CATEGORY_ICONS.find(([pattern]) => pattern.test(category ?? ''));
  return match ? { emoji: match[1], color: match[2] } : { emoji: '🏪', color: '#7c3aed' };
}

function shopIcon(category: string | null, selected: boolean) {
  const { emoji, color } = categoryStyle(category);
  const size = selected ? 44 : 36;
  return L.divIcon({
    className: 'shop-map-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);font-size:${selected ? 22 : 18}px">${emoji}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const userIcon = L.divIcon({
  className: 'user-map-marker',
  html: '<span style="display:block;width:20px;height:20px;border-radius:9999px;background:#2563eb;border:4px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const formatKm = (km: number | null) => (km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/** Ajusta la vista para que se vean todos los comercios (y el usuario). */
function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = points.map((point) => point.join(',')).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/** Centra y abre el comercio elegido desde la lista. */
function FocusShop({ shop, markers }: { shop: NearbyShop | null; markers: React.RefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    if (!shop?.latitud || !shop.longitud) return;
    map.flyTo([shop.latitud, shop.longitud], 16, { duration: 0.8 });
    window.setTimeout(() => markers.current?.get(shop.id)?.openPopup(), 850);
  }, [shop, map, markers]);
  return null;
}

function PickOnClick({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => { if (enabled) onPick(event.latlng.lat, event.latlng.lng); } });
  return null;
}

type ShopsMapProps = {
  shops: NearbyShop[];
  userLocation: { latitude: number; longitude: number } | null;
  radiusKm: number | null;
  selectedShop: NearbyShop | null;
  pickMode: boolean;
  onPickLocation: (lat: number, lng: number) => void;
};

export default function ShopsMap({ shops, userLocation, radiusKm, selectedShop, pickMode, onPickLocation }: ShopsMapProps) {
  const markers = useRef(new Map<string, L.Marker>());
  const located = useMemo(() => shops.filter((shop) => shop.latitud != null && shop.longitud != null), [shops]);
  const points = useMemo(() => {
    const list: Array<[number, number]> = located.map((shop) => [shop.latitud!, shop.longitud!]);
    if (userLocation) list.push([userLocation.latitude, userLocation.longitude]);
    return list;
  }, [located, userLocation]);

  return (
    <MapContainer
      center={GUAIRA_CENTER}
      zoom={10}
      scrollWheelZoom
      className={`h-[420px] w-full rounded-2xl ${pickMode ? 'cursor-crosshair' : ''}`}
      aria-label="Mapa de comercios del Guairá"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      <FocusShop shop={selectedShop} markers={markers} />
      <PickOnClick enabled={pickMode} onPick={onPickLocation} />

      {userLocation && (
        <>
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
            <Popup>Tu ubicación</Popup>
          </Marker>
          {radiusKm && (
            <Circle
              center={[userLocation.latitude, userLocation.longitude]}
              radius={radiusKm * 1000}
              pathOptions={{ color: '#2563eb', fillOpacity: 0.06, weight: 1.5 }}
            />
          )}
        </>
      )}

      {located.map((shop) => (
        <Marker
          key={shop.id}
          position={[shop.latitud!, shop.longitud!]}
          icon={shopIcon(shop.categoria_principal, selectedShop?.id === shop.id)}
          ref={(marker) => { if (marker) markers.current.set(shop.id, marker); else markers.current.delete(shop.id); }}
        >
          <Popup>
            <div className="min-w-44 space-y-1">
              <p className="text-sm font-black text-slate-900">{shop.nombre_comercio}</p>
              <p className="text-xs text-slate-600">{categoryStyle(shop.categoria_principal).emoji} {shop.categoria_principal || 'Comercio'}</p>
              {shop.distrito && <p className="text-xs text-slate-600">📍 {shop.distrito}</p>}
              {formatKm(shop.distancia_km) && <p className="text-xs font-bold text-blue-700">A {formatKm(shop.distancia_km)} de ti</p>}
              <p className="text-xs text-slate-500">{shop.total_productos} {shop.total_productos === 1 ? 'producto' : 'productos'}</p>
              <div className="flex gap-2 pt-1">
                {shop.slug && <a href={`/tienda/${encodeURIComponent(shop.slug)}`} className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold !text-white">Ver tienda</a>}
                {shop.latitud != null && shop.longitud != null && (
                  <a
                    href={`https://www.openstreetmap.org/directions?to=${shop.latitud}%2C${shop.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700"
                  >
                    Cómo llegar
                  </a>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
