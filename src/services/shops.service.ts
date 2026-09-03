import { createBrowserClient } from '@supabase/ssr';

export async function getFeaturedShops() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: shops, error } = await supabase
    .from('tiendas')
    .select(`
      *,
      distritos (
        id,
        nombre
      )
    `)
    .eq('activo', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener tiendas:', error.message);
    return [];
  }

  return shops || [];
}