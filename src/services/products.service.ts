import { supabase } from '@/lib/supabase';

export interface Product {
  id: string;
  tienda_id: string;
  categoria_id: number;
  titulo: string;
  descripcion: string;
  precio_gs: number;
  imagen_url: string;
  disponible: boolean;
  destacado: boolean;
  vistas_count: number;
  creado_en: string;
  actualizado_en: string;
}

export async function getProducts(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('disponible', true)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return (data as Product[] | null) || [];
  } catch (error) {
    console.error('Error cargando productos desde Supabase:', error);
    return [];
  }
}

export async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('disponible', true)
      .eq('destacado', true)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return (data as Product[] | null) || [];
  } catch (error) {
    console.error('Error cargando productos destacados desde Supabase:', error);
    return [];
  }
}

export async function getProductsByShop(tiendaId: string): Promise<Product[]> {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('tienda_id', tiendaId)
      .eq('disponible', true)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return (data as Product[] | null) || [];
  } catch (error) {
    console.error('Error cargando productos de la tienda desde Supabase:', error);
    return [];
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', id)
      .eq('disponible', true)
      .maybeSingle();

    if (error) throw error;
    return data as Product | null;
  } catch (error) {
    console.error('Error cargando producto desde Supabase:', error);
    return null;
  }
}