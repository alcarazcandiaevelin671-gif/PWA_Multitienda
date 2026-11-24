/**
 * [PÁGINA] Página /productos/[id]: enlace permanente de un producto (lo usa el buscador).
 * Redirige al producto dentro de la vitrina de su tienda (/tienda/<slug>#product-<id>).
 */
import { notFound, redirect } from 'next/navigation';
import { supabase } from '@/shared/supabase/client';

export default async function ProductPermalinkPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data } = await supabase
    .from('productos')
    .select('id, tienda:tiendas!inner(slug)')
    .eq('id', id)
    .eq('tienda.estado', 'activa')
    .maybeSingle();

  const tienda = (Array.isArray(data?.tienda) ? data?.tienda[0] : data?.tienda) as { slug?: string | null } | null | undefined;
  if (!data || !tienda?.slug) notFound();
  redirect(`/tienda/${encodeURIComponent(tienda.slug)}#product-${data.id}`);
}
