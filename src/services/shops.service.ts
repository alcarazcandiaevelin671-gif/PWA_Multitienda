import { supabase } from '@/lib/supabase';

export async function getFeaturedShops() {
  try {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .eq('estado', 'activa')
      .limit(8);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error cargando tiendas desde Supabase:', error);
    return [];
  }
}