/**
 * [BACKEND] Datos de la vitrina de una tienda (/tienda/[slug]) en una sola ronda a Supabase:
 * la tienda con sus productos disponibles (consulta anidada) y las categorías, en paralelo.
 *
 * Usa el cliente con la sesión del visitante (cookies), así RLS decide qué puede ver.
 * Si la tienda no está activa, sus productos solo los ve su propio dueño.
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

  let productos = tienda.productos;
  if (tienda.estado !== 'activa') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id !== tienda.usuario_id) productos = [];
  }

  return {
    tienda: { ...tienda, productos },
    productos,
    categorias: categoriasResult.data,
  };
}
