/**
 * [FRONTEND] Señales del usuario (favoritos, búsquedas, compras) y llamada a /api/recommendations.
 *
 * Las señales se leen con la sesión del propio usuario (RLS): nadie ve el historial de otro.
 * La ubicación solo se envía si el usuario la consintió (location-consent.ts) y no se guarda.
 */
import { supabase } from '@/shared/supabase/client';
import { getStoredLocation } from '@/frontend/lib/location-consent';

export type RecommendationSignals = {
  favoriteIds: string[];
  purchasedIds: string[];
  searchTerms: string[];
  categoryIds: string[];
  favoriteShopIds: string[];
  /** Productos que está viendo o tiene en el carrito. */
  contextIds?: string[];
};

export type AIRecommendation = {
  id: string;
  nombre: string;
  precio: number;
  /** Precio de oferta opcional (se muestra con el precio normal tachado). */
  precio_oferta?: number | null;
  imagen_url: string | null;
  tienda_id: string;
  tienda_slug: string | null;
  tienda_nombre: string | null;
  distancia_km?: number | null;
  similarity_score: number;
  /** Explicación de por qué se recomienda (transparencia del algoritmo). */
  motivo?: string;
};

export type ShopRecommendation = {
  id: string;
  slug: string | null;
  nombre_comercio: string | null;
  categoria_principal: string | null;
  logo_url: string | null;
  distrito: string | null;
  distancia_km: number | null;
  total_productos: number;
  score: number;
  motivo: string;
};

export async function getRecommendationSignals(userId: string | null): Promise<RecommendationSignals> {
  const signals: RecommendationSignals = { favoriteIds: [], purchasedIds: [], searchTerms: [], categoryIds: [], favoriteShopIds: [] };
  if (!userId) return signals;

  const [favoritesResult, historyResult, ordersResult] = await Promise.all([
    supabase.from('favoritos').select('producto_id, tienda_id').eq('usuario_id', userId).order('creado_en', { ascending: false }).limit(30),
    supabase.from('historial_busquedas').select('termino, categoria_id').eq('usuario_id', userId).order('fecha_hora', { ascending: false }).limit(20),
    supabase.from('pedidos').select('id').eq('usuario_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  signals.favoriteIds = Array.from(new Set((favoritesResult.data || [])
    .map((item) => item.producto_id)
    .filter((id): id is string => typeof id === 'string'))).slice(0, 12);
  signals.favoriteShopIds = Array.from(new Set((favoritesResult.data || [])
    .filter((item) => !item.producto_id)
    .map((item) => item.tienda_id)
    .filter((id): id is string => typeof id === 'string'))).slice(0, 12);
  signals.searchTerms = Array.from(new Set((historyResult.data || [])
    .map((item) => item.termino?.trim())
    .filter((term): term is string => typeof term === 'string' && term.length >= 2)))
    .slice(0, 12);
  signals.categoryIds = Array.from(new Set((historyResult.data || [])
    .map((item) => item.categoria_id)
    .filter((id): id is number => typeof id === 'number')
    .map(String)));

  const orderIds = (ordersResult.data || []).map((order) => order.id);
  if (orderIds.length > 0) {
    const { data: orderDetails } = await supabase
      .from('pedido_detalles')
      .select('producto_id, cantidad')
      .in('pedido_id', orderIds)
      .not('producto_id', 'is', null);

    const quantities = new Map<string, number>();
    for (const detail of orderDetails || []) {
      if (detail.producto_id) quantities.set(detail.producto_id, (quantities.get(detail.producto_id) || 0) + detail.cantidad);
    }
    signals.purchasedIds = [...quantities.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([id]) => id);
  }

  return signals;
}

function buildParams(signals: RecommendationSignals, tipo: string, limit: number) {
  const params = new URLSearchParams({ tipo, limit: String(limit) });
  signals.favoriteIds.forEach((id) => params.append('favoriteId', id));
  signals.purchasedIds.forEach((id) => params.append('purchasedId', id));
  signals.searchTerms.forEach((term) => params.append('searchTerm', term));
  signals.categoryIds.forEach((id) => params.append('categoryId', id));
  signals.favoriteShopIds.forEach((id) => params.append('favoriteShopId', id));
  (signals.contextIds || []).forEach((id) => params.append('contextId', id));
  const location = getStoredLocation();
  if (location) {
    params.set('lat', location.latitude.toFixed(5));
    params.set('lng', location.longitude.toFixed(5));
  }
  return params;
}

async function getJsonArray<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data as T[] : [];
}

/** Productos recomendados para el usuario (motor híbrido). */
export function fetchAIRecommendations(signals: RecommendationSignals, limit = 8) {
  return getJsonArray<AIRecommendation>(`/api/recommendations?${buildParams(signals, 'productos', limit)}`);
}

/** Comercios relevantes para el usuario (afinidad + cercanía + rubro de sus favoritos). */
export function fetchShopRecommendations(signals: RecommendationSignals, limit = 4) {
  return getJsonArray<ShopRecommendation>(`/api/recommendations?${buildParams(signals, 'comercios', limit)}`);
}

/** Productos que suelen comprarse junto con los indicados (filtrado colaborativo). */
export function fetchComplementaryProducts(productIds: string[], limit = 4) {
  const signals: RecommendationSignals = {
    favoriteIds: [], purchasedIds: [], searchTerms: [], categoryIds: [], favoriteShopIds: [], contextIds: productIds,
  };
  return getJsonArray<AIRecommendation>(`/api/recommendations?${buildParams(signals, 'complementarios', limit)}`);
}