import { supabase } from '@/lib/supabase';

export async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true }); // ✅ Eliminado el .eq('activo', true)

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error cargando categorías desde Supabase:', error);
    return [];
  }
}