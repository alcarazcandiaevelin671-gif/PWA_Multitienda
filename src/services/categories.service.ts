import { supabase } from '@/lib/supabase';

export async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true }); // ✅ Eliminado el .eq('activo', true)

    if (error) throw error;
    const categories = data || [];
    if (categories.length === 0) return categories;

    const { data: ranking, error: rankingError } = await supabase
      .rpc('categorias_mas_interactuadas', { p_limit: categories.length });
    if (rankingError || !ranking?.length) return categories;

    const rankingRows = ranking as Array<{ categoria_id: number }>;
    const rankingById = new Map<string, number>(rankingRows.map((item, index): [string, number] => [String(item.categoria_id), index]));
    return [...categories].sort((left, right) => {
      const leftRank = rankingById.get(String(left.id)) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = rankingById.get(String(right.id)) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || String(left.nombre || '').localeCompare(String(right.nombre || ''), 'es');
    });
  } catch (error) {
    console.error('Error cargando categorías desde Supabase:', error);
    return [];
  }
}