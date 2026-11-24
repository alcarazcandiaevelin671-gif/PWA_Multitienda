/**
 * [FRONTEND] Comercios cercanos: consulta espacial en la base con PostGIS (función tiendas_cercanas).
 *
 * La distancia la calcula PostgreSQL/PostGIS (ST_Distance sobre geography, en metros) y el radio
 * usa ST_DWithin con el índice espacial GIST. Si no hay conexión, se calcula en el navegador con
 * la fórmula de Haversine sobre la última lista conocida (respaldo offline).
 */
import { supabase } from '@/shared/supabase/client';
import { haversineDistanceKm } from '@/frontend/lib/geolocation';

export type NearbyShop = {
  id: string;
  slug: string | null;
  nombre_comercio: string | null;
  descripcion: string | null;
  categoria_principal: string | null;
  logo_url: string | null;
  portada_url: string | null;
  whatsapp: string | null;
  latitud: number | null;
  longitud: number | null;
  distrito_id: number | null;
  distrito: string | null;
  distancia_km: number | null;
  total_productos: number;
};

export type NearbyFilters = {
  location: { latitude: number; longitude: number } | null;
  radiusKm: number | null;
  districtId: number | null;
  category: string | null;
};

/** Comercios activos filtrados y ordenados por distancia (PostGIS). Lanza error si falla la red. */
export async function fetchNearbyShops(filters: NearbyFilters): Promise<NearbyShop[]> {
  const { data, error } = await supabase.rpc('tiendas_cercanas', {
    p_lat: filters.location?.latitude ?? null,
    p_lng: filters.location?.longitude ?? null,
    p_radio_km: filters.location ? filters.radiusKm : null,
    p_distrito_id: filters.districtId,
    p_categoria: filters.category,
  });
  if (error) throw error;
  return (data || []) as NearbyShop[];
}

/** Respaldo sin conexión: mismos filtros calculados en el navegador (Haversine). */
export function filterShopsOffline(shops: NearbyShop[], filters: NearbyFilters): NearbyShop[] {
  return shops
    .filter((shop) => filters.districtId == null || shop.distrito_id === filters.districtId)
    .filter((shop) => !filters.category || shop.categoria_principal === filters.category)
    .map((shop) => ({
      ...shop,
      distancia_km: filters.location && shop.latitud != null && shop.longitud != null
        ? haversineDistanceKm(filters.location.latitude, filters.location.longitude, shop.latitud, shop.longitud)
        : null,
    }))
    .filter((shop) => !filters.location || filters.radiusKm == null || (shop.distancia_km != null && shop.distancia_km <= filters.radiusKm))
    .sort((left, right) => (left.distancia_km ?? Infinity) - (right.distancia_km ?? Infinity)
      || String(left.nombre_comercio).localeCompare(String(right.nombre_comercio)));
}
