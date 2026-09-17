import { supabase } from '@/lib/supabase';

export interface Product {
  id?: string;
  tienda_id: string;
  titulo: string;
  descripcion?: string;
  precio_gs: number;
  imagen_url?: string;
  categoria_id?: number;
  disponible?: boolean;
  creado_en?: string;
}

// Obtener productos de una tienda específica
export async function getProductsByShop(tiendaId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('tienda_id', tiendaId)
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al obtener productos:', error);
    return [];
  }

  return data || [];
}

// Crear un nuevo producto
export async function createProduct(product: Omit<Product, 'id' | 'creado_en'>) {
  const { data, error } = await supabase
    .from('productos')
    .insert([product])
    .select()
    .single();

  if (error) {
    console.error('Error al crear producto:', error);
    throw error;
  }

  return data;
}

// Eliminar un producto
export async function deleteProduct(productId: string) {
  const { error } = await supabase
    .from('productos')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Error al eliminar producto:', error);
    throw error;
  }
}