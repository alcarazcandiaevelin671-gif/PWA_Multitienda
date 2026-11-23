/**
 * [BACKEND] Carga de productos para las páginas públicas que se renderizan en el servidor
 * (/tiendas). Usa el cliente anónimo: solo lee lo que RLS permite ver a cualquiera.
 *
 * Las operaciones de comerciante (crear/editar/borrar productos con la sesión del usuario)
 * están en frontend/services/products.service.ts.
 */
import 'server-only';
import { supabase } from '@/shared/supabase/client';
import type { FeaturedProduct, ProductDistrict } from '@/shared/types/catalog';

/** Distritos activos, ordenados por nombre (filtro de ubicación del catálogo). */
export async function getProductDistricts(): Promise<ProductDistrict[]> {
  const { data, error } = await supabase
    .from('distritos')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error al obtener distritos disponibles:', error);
    return [];
  }

  return (data || []).filter((district): district is ProductDistrict => district.id !== null && district.nombre !== null);
}

/**
 * Últimos 60 productos disponibles con los datos de su tienda (una sola consulta anidada).
 * Ante un error devuelve una lista vacía para que la página se muestre igual.
 */
export async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('id, tienda_id, titulo, descripcion, precio_gs, precio_oferta, stock, stock_minimo, imagen_url, categoria_id, creado_en, tienda:tiendas(nombre_comercio, slug, latitud, longitud, distrito_id)')
    .eq('disponible', true)
    .order('creado_en', { ascending: false })
    .limit(60);

  if (error) {
    console.error('Error al obtener productos disponibles:', error);
    return [];
  }

  return (data || []) as unknown as FeaturedProduct[];
}
