'use client';

/**
 * [FRONTEND] Mapa (Leaflet) para elegir una ubicación con un clic o con la ubicación actual.
 * El mapa se centra en el punto elegido y, si se pide (onAddress), busca la dirección y la
 * localidad de ese punto en OpenStreetMap (Nominatim) para completar el formulario.
 */
import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { showAppMessage } from '@/frontend/lib/app-message';


// Íconos servidos desde /public/leaflet (antes desde unpkg.com: dependencia de un tercero y
// filtración de la IP del usuario). URL directa: funciona igual con webpack y Turbopack.
const customIcon = L.icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

/** Dirección aproximada del punto elegido (OpenStreetMap). */
export interface DireccionEncontrada {
  /** Calle y número, o el lugar más cercano con nombre. */
  direccion: string;
  /** Nombres de ciudad, pueblo, barrio y municipio, para buscar el distrito. */
  localidades: string[];
}

interface LocationPickerProps {
  latInicial?: number;
  lngInicial?: number;
  onLocationChange?: (lat: number, lng: number) => void;
  /** Si se indica, después de elegir un punto se busca su dirección y se entrega aquí. */
  onAddress?: (direccion: DireccionEncontrada) => void;
}

// Componente interno para capturar el clic en el mapa
function MapEvents({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// El centro de MapContainer solo se usa al crearlo: este componente lo mueve al punto elegido.
function SeguirPunto({ position, acercar }: { position: [number, number]; acercar: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, acercar ? Math.max(map.getZoom(), 16) : map.getZoom(), { animate: true });
  }, [map, position, acercar]);
  return null;
}

async function buscarDireccion(lat: number, lng: number): Promise<DireccionEncontrada | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) return null;
  const data = await response.json();
  const a = (data?.address ?? {}) as Record<string, string | undefined>;
  const calle = [a.road ?? a.pedestrian ?? a.footway, a.house_number].filter(Boolean).join(' ');
  const lugar = a.amenity ?? a.shop ?? a.building ?? a.neighbourhood ?? a.suburb ?? a.hamlet;
  const localidades = [a.city, a.town, a.village, a.municipality, a.city_district, a.county, a.suburb, a.hamlet]
    .filter((valor): valor is string => Boolean(valor));
  return { direccion: calle || lugar || '', localidades };
}

export default function LocationPicker({
  latInicial = -25.7806, // Coordenadas predeterminadas: Villarrica, Guairá
  lngInicial = -56.4486,
  onLocationChange,
  onAddress,
}: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>([latInicial, lngInicial]);
  const [acercar, setAcercar] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [buscandoDireccion, setBuscandoDireccion] = useState(false);
  const consulta = useRef(0);

  // Las pantallas que cargan la ubicación guardada después de montar el mapa la envían por props.
  useEffect(() => {
    setPosition((actual) => (actual[0] === latInicial && actual[1] === lngInicial ? actual : [latInicial, lngInicial]));
  }, [latInicial, lngInicial]);

  const handleSelect = (lat: number, lng: number, desdeGps = false) => {
    setPosition([lat, lng]);
    setAcercar(desdeGps);
    // Protección para evitar el runtime error "is not a function"
    if (typeof onLocationChange === 'function') {
      onLocationChange(lat, lng);
    }
    if (typeof onAddress === 'function') {
      const numero = ++consulta.current;
      setBuscandoDireccion(true);
      buscarDireccion(lat, lng)
        .then((resultado) => {
          if (numero === consulta.current && resultado) onAddress(resultado);
        })
        .catch(() => { /* Sin dirección: se completa a mano. */ })
        .finally(() => {
          if (numero === consulta.current) setBuscandoDireccion(false);
        });
    }
  };

  const handleUseGPS = () => {
    if (!('geolocation' in navigator)) {
      showAppMessage('Este navegador no permite obtener la ubicación. Toca el mapa para marcar tu comercio.', 'Ubicación no disponible', 'error');
      return;
    }
    setBuscandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscandoGps(false);
        handleSelect(pos.coords.latitude, pos.coords.longitude, true);
      },
      (error) => {
        setBuscandoGps(false);
        const motivo = error.code === error.PERMISSION_DENIED
          ? 'El navegador no tiene permiso para usar tu ubicación. Actívalo en el candado de la barra de direcciones, o toca el mapa para marcar tu comercio.'
          : error.code === error.TIMEOUT
            ? 'La ubicación tardó demasiado. Activa el GPS del celular e inténtalo de nuevo, o toca el mapa.'
            : 'No se pudo obtener la ubicación actual. Activa el GPS o toca el mapa para marcar tu comercio.';
        showAppMessage(motivo, 'Ubicación no disponible', 'error');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-semibold text-slate-700">
          Ubicación en el Mapa (Haz clic para mover el marcador)
        </label>
        <button
          type="button"
          onClick={handleUseGPS}
          disabled={buscandoGps}
          className="flex min-h-9 cursor-pointer items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70"
        >
          📍 {buscandoGps ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}
        </button>
      </div>

      <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-300 shadow-inner z-0">
        <MapContainer
          center={position}
          zoom={14}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} icon={customIcon} />
          <MapEvents onSelect={(lat, lng) => handleSelect(lat, lng)} />
          <SeguirPunto position={position} acercar={acercar} />
        </MapContainer>
      </div>

      <p className="text-xs text-slate-500" aria-live="polite">
        Coordenadas seleccionadas: <span className="font-mono text-slate-700">{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
        {buscandoDireccion && <span className="ml-2 text-slate-400">· buscando la dirección…</span>}
      </p>
    </div>
  );
}
