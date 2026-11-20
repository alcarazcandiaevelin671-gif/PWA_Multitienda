import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export async function getFeaturedShops() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const shopsClient = serviceRoleKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    : supabase;
  const { data: shops, error } = await shopsClient
    .from('tiendas')
    .select(`
      id,
      slug,
      nombre_comercio,
      descripcion,
      categoria_principal,
      latitud,
      longitud,
      logo_url,
      portada_url,
      whatsapp,
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

  return (shops || []).map((shop) => ({
    ...shop,
    distritos: Array.isArray(shop.distritos) ? shop.distritos[0] ?? null : shop.distritos,
    verificada: true,
  }));
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