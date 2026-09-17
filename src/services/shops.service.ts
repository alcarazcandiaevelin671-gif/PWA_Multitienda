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
    .eq('estado', 'aprobado') // ✅ Cambiado 'activo' por 'estado' (ajusta 'aprobado' según tu ENUM)
    .order('creado_en', { ascending: false }); // ✅ Cambiado 'created_at' por 'creado_en'

  if (error) {
    console.error('Error al obtener tiendas:', error.message);
    return [];
  }

  return shops || [];
}