/**
 * [BACKEND] Comercios destacados para las páginas públicas renderizadas en el servidor
 * (inicio y categorías). Solo devuelve tiendas con estado "activa".
 *
 * Usa el cliente con clave de servidor si está configurado (lectura completa de las
 * tiendas activas) y, si no, el cliente anónimo como respaldo.
 */
import 'server-only';
import { supabase } from '@/shared/supabase/client';
import { createAdminClient } from '@/backend/supabase/admin-client';

export async function getFeaturedShops() {
  const shopsClient = createAdminClient() ?? supabase;
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
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al obtener tiendas:', error.message);
    return [];
  }

  // Supabase devuelve la relación como lista; la tarjeta espera un único distrito.
  return (shops || []).map((shop) => ({
    ...shop,
    distritos: Array.isArray(shop.distritos) ? shop.distritos[0] ?? null : shop.distritos,
    verificada: true,
  }));
}
