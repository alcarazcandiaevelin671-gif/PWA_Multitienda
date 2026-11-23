/**
 * [BACKEND] Datos de la vitrina de una tienda (/tienda/[slug]) en una sola ronda a Supabase:
 * la tienda con sus productos disponibles (consulta anidada) y las categorías, en paralelo.
 *
 * Usa el cliente con la sesión del visitante (cookies), así RLS decide qué puede ver.
 * Devuelve `null` si la tienda no existe (la página responde 404).
 */
import 'server-only';
import { createSupabaseServerClient } from '@/backend/supabase/server-client';

export async function getStorefront(slug: string) {
  const supabase = await createSupabaseServerClient();
  const [tiendaResult, categoriasResult] = await Promise.all([
    supabase
      .from('tiendas')
      .select('*, productos(*)')
      .eq('slug', slug)
      .eq('productos.disponible', true)
      .order('creado_en', { referencedTable: 'productos', ascending: false })
      .maybeSingle(),
    supabase.from('categorias').select('id, nombre'),
  ]);

  const tienda = tiendaResult.data;
  if (tiendaResult.error || !tienda) return null;

  return {
    tienda,
    productos: tienda.productos,
    categorias: categoriasResult.data,
  };
}
