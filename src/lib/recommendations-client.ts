import { supabase } from '@/lib/supabase';

export type RecommendationSignals = {
  favoriteIds: string[];
  purchasedIds: string[];
  searchTerms: string[];
  categoryIds: string[];
};

export type AIRecommendation = {
  id: string;
  nombre: string;
  precio: number;
  imagen_url: string | null;
  tienda_id: string;
  tienda_slug: string | null;
  tienda_nombre: string | null;
  similarity_score: number;
};

export async function getRecommendationSignals(userId: string | null): Promise<RecommendationSignals> {
  const signals: RecommendationSignals = { favoriteIds: [], purchasedIds: [], searchTerms: [], categoryIds: [] };
  if (!userId) return signals;

  const [favoritesResult, historyResult, ordersResult] = await Promise.all([
    supabase.from('favoritos').select('producto_id').eq('usuario_id', userId).not('producto_id', 'is', null).order('created_at', { ascending: false }).limit(12),
    supabase.from('historial_busquedas').select('termino, categoria_id').eq('usuario_id', userId).order('fecha_hora', { ascending: false }).limit(20),
    supabase.from('pedidos').select('id').eq('usuario_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  signals.favoriteIds = Array.from(new Set((favoritesResult.data || [])
    .map((item) => item.producto_id)
    .filter((id): id is string => typeof id === 'string')));
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

export async function fetchAIRecommendations(signals: RecommendationSignals, limit = 8) {
  const params = new URLSearchParams({ limit: String(limit) });
  signals.favoriteIds.forEach((id) => params.append('favoriteId', id));
  signals.purchasedIds.forEach((id) => params.append('purchasedId', id));
  signals.searchTerms.forEach((term) => params.append('searchTerm', term));
  signals.categoryIds.forEach((id) => params.append('categoryId', id));

  const response = await fetch(`/api/recommendations?${params.toString()}`, { cache: 'no-store' });
  if (!response.ok) return [] as AIRecommendation[];
  const data = await response.json();
  return Array.isArray(data) ? data as AIRecommendation[] : [];
}