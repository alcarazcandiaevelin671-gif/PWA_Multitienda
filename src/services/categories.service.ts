import { supabase } from '@/lib/supabase';

export async function getCategories() {
  try {
    let respuesta = await supabase.from('categorías').select('*');
    if (respuesta.error || !respuesta.data || respuesta.data.length === 0) {
      const alt = await supabase.from('categorias').select('*');
      if (alt.data && alt.data.length > 0) {
        respuesta = alt;
      }
    }
    if (respuesta.error) throw respuesta.error;
    return respuesta.data || [];
  } catch (error) {
    console.error('Error cargando categorías desde Supabase:', error);
    return [];
  }
}