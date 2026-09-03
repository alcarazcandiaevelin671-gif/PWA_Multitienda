'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Corregir icono por defecto de Leaflet en Next.js
const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LocationPickerProps {
  latInicial?: number;
  lngInicial?: number;
  onLocationChange: (lat: number, lng: number) => void;
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

export default function LocationPicker({
  latInicial = -25.7806, // Coordenadas predeterminadas: Villarrica, Guairá
  lngInicial = -56.4486,
  onLocationChange,
}: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>([latInicial, lngInicial]);

  const handleSelect = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onLocationChange(lat, lng);
  };

  const handleUseGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition([latitude, longitude]);
          onLocationChange(latitude, longitude);
        },
        (error) => {
          alert('No se pudo obtener la ubicación actual. Revisa los permisos de tu navegador.');
        }
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">
          Ubicación en el Mapa (Haz clic para mover el marcador)
        </label>
        <button
          type="button"
          onClick={handleUseGPS}
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          📍 Usar mi ubicación actual
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
          <MapEvents onSelect={handleSelect} />
        </MapContainer>
      </div>

      <p className="text-xs text-slate-500">
        Coordenadas seleccionadas: <span className="font-mono text-slate-700">{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
      </p>
    </div>
  );
}