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
import type { NearbyShop } from '@/frontend/services/shops-map.service';

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

/**
 * Comercios activos para el mapa (/comercios), con su distrito y cantidad de productos.
 * Usa la función espacial `tiendas_cercanas` (PostGIS); sin ubicación devuelve todos ordenados por nombre.
 */
export async function getShopsForMap(): Promise<NearbyShop[]> {
  const { data, error } = await supabase.rpc('tiendas_cercanas', {});
  if (!error && data) return data as NearbyShop[];

  console.error('tiendas_cercanas no disponible, se usa el listado básico:', error?.message);
  const shops = await getFeaturedShops();
  return shops.map((shop) => ({
    id: shop.id,
    slug: shop.slug ?? null,
    nombre_comercio: shop.nombre_comercio ?? null,
    descripcion: shop.descripcion ?? null,
    categoria_principal: shop.categoria_principal ?? null,
    logo_url: shop.logo_url ?? null,
    portada_url: shop.portada_url ?? null,
    whatsapp: shop.whatsapp ?? null,
    latitud: shop.latitud == null ? null : Number(shop.latitud),
    longitud: shop.longitud == null ? null : Number(shop.longitud),
    distrito_id: (shop.distritos as { id?: number } | null)?.id ?? null,
    distrito: (shop.distritos as { nombre?: string } | null)?.nombre ?? null,
    distancia_km: null,
    total_productos: 0,
  }));
}
