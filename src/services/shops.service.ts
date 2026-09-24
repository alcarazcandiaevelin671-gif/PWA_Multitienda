import { supabase } from '@/lib/supabase';

export async function getFeaturedShops() {
  const { data: shops, error } = await supabase
    .from('tiendas')
    .select(`
      *,
      distritos (
        id,
        nombre
      )
    `)
    .eq('estado', 'activa')
    .order('creado_en', { ascending: false }); // ✅ Cambiado 'created_at' por 'creado_en'

  if (error) {
    console.error('Error al obtener tiendas:', error.message);
    return [];
  }

  return shops || [];
}

export const shopsService = {
  async getShopsByOwner(ownerId: string) {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .eq('usuario_id', ownerId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};