import { supabase } from '@/lib/supabase';
import { Product } from './products.service';

const MAX_RESULTS = 20;

export interface Shop {
  id: string;
  distrito_id: number;
  nombre_comercio: string;
  slug: string;
  descripcion: string;
  categoria_principal: string;
  estado: string;
  verificada: boolean;
  whatsapp: string;
  telefono: string;
  direccion_texto: string;
  latitud: number;
  longitud: number;
}

function getSearchTerm(term: string): string | null {
  const normalizedTerm = term.trim();
  return normalizedTerm.length > 0 ? normalizedTerm : null;
}

export async function searchProducts(term: string): Promise<Product[]> {
  const searchTerm = getSearchTerm(term);

  if (!searchTerm) return [];

  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('disponible', true)
      .or(`titulo.ilike.%${searchTerm}%,descripcion.ilike.%${searchTerm}%`)
      .order('destacado', { ascending: false })
      .order('creado_en', { ascending: false })
      .limit(MAX_RESULTS);

    if (error) throw error;
    return (data as Product[] | null) || [];
  } catch (error) {
    console.error('Error buscando productos desde Supabase:', error);
    return [];
  }
}

export async function searchShops(term: string): Promise<Shop[]> {
  const searchTerm = getSearchTerm(term);

  if (!searchTerm) return [];

  try {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .eq('estado', 'activa')
      .or(
        `nombre_comercio.ilike.%${searchTerm}%,descripcion.ilike.%${searchTerm}%,categoria_principal.ilike.%${searchTerm}%`,
      )
      .limit(MAX_RESULTS);

    if (error) throw error;
    return (data as Shop[] | null) || [];
  } catch (error) {
    console.error('Error buscando tiendas desde Supabase:', error);
    return [];
  }
}

export async function searchAll(term: string): Promise<{
  products: Product[];
  shops: Shop[];
}> {
  const searchTerm = getSearchTerm(term);

  if (!searchTerm) {
    return { products: [], shops: [] };
  }

  const [products, shops] = await Promise.all([
    searchProducts(searchTerm),
    searchShops(searchTerm),
  ]);

  return { products, shops };
}