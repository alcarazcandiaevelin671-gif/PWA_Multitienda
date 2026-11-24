/**
 * [FRONTEND] Ubicación del usuario con CONSENTIMIENTO explícito (privacidad desde el diseño).
 *
 * Reglas (Constitución Nacional art. 33, minimización de datos):
 *   - Nunca se pide la ubicación sin que el usuario toque "Usar mi ubicación" después de leer para qué se usa.
 *   - Se guarda SOLO en este dispositivo (localStorage) y vence a los 30 minutos.
 *   - Se envía al servidor únicamente para calcular distancias (PostGIS) y no se almacena en la base.
 *   - El usuario puede retirar el consentimiento en cualquier momento (forgetLocation).
 *   - Excepción informada: el punto de entrega que el cliente marca en el checkout sí se guarda en su pedido.
 */

export type Coordinates = { latitude: number; longitude: number };

const STORAGE_KEY = 'pg_ubicacion_consentida';
const MAX_AGE_MS = 30 * 60 * 1000;

/** Texto común que se muestra antes de pedir permiso. */
export const LOCATION_PURPOSE = 'Usamos tu ubicación solo para ordenar comercios y productos por cercanía. Queda en este dispositivo por 30 minutos y no se guarda en nuestra base de datos.';

/** Ubicación consentida y vigente, o `null`. */
export function getStoredLocation(): Coordinates | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Coordinates & { savedAt: number };
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude) || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return { latitude: parsed.latitude, longitude: parsed.longitude };
  } catch {
    return null;
  }
}

/** Guarda una ubicación elegida por el usuario (GPS o clic en el mapa). */
export function saveLocation(coordinates: Coordinates) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...coordinates, savedAt: Date.now() }));
    window.dispatchEvent(new Event('pg-ubicacion'));
  } catch {
    // modo privado sin almacenamiento: se usa solo en esta pantalla
  }
}

/** Retira el consentimiento y borra la ubicación guardada. */
export function forgetLocation() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('pg-ubicacion'));
  } catch {
    // sin almacenamiento disponible
  }
}

/** Mensaje claro para cada error del GPS. */
export function locationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return 'No se concedió el permiso de ubicación. Puedes elegir tu punto en el mapa.';
  if (error.code === error.POSITION_UNAVAILABLE) return 'No se pudo determinar tu ubicación (GPS sin señal). Puedes elegirla en el mapa.';
  if (error.code === error.TIMEOUT) return 'La ubicación tardó demasiado. Inténtalo de nuevo o elígela en el mapa.';
  return 'No se pudo obtener tu ubicación.';
}

/**
 * Pide la ubicación al GPS. Llamar SOLO desde un botón que el usuario tocó después de ver
 * LOCATION_PURPOSE. Si la obtiene, la guarda en el dispositivo.
 */
export function requestLocationWithConsent(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Tu navegador no ofrece geolocalización. Puedes elegir tu punto en el mapa.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        saveLocation(coordinates);
        resolve(coordinates);
      },
      (error) => reject(new Error(locationErrorMessage(error))),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 120_000 },
    );
  });
}
