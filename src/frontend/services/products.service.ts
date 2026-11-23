/**
 * [FRONTEND] Operaciones de comerciante sobre sus productos (listar, crear, editar, borrar).
 *
 * Se ejecutan en el navegador con la sesión del usuario: Supabase aplica RLS, así que un
 * comerciante solo puede tocar los productos de su propia tienda.
 * La carga del catálogo público para páginas del servidor está en backend/catalog/products.ts.
 */
import { supabase } from '@/shared/supabase/client';
import type { Product } from '@/shared/types/catalog';
import type { Product as AdminProduct } from '@/shared/types/product';

/** Productos de una tienda, del más nuevo al más viejo. Devuelve [] si falla. */
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

/** Crea un producto y devuelve la fila creada. */
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

/** Elimina un producto por id. */
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

/** Variante agrupada para el panel del comerciante (lanza el error en lugar de devolver []). */
export const productsService = {
  async getProductsByShop(shopId: string): Promise<AdminProduct[]> {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('tienda_id', shopId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return (data || []) as AdminProduct[];
  },

  async createProduct(product: Omit<AdminProduct, 'id' | 'creado_en'>) {
    const { data, error } = await supabase
      .from('productos')
      .insert([product])
      .select()
      .single();

    if (error) throw error;
    return data as AdminProduct;
  },

  deleteProduct,

  async updateProduct(productId: string, updates: Partial<AdminProduct>) {
    const { data, error } = await supabase
      .from('productos')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data as AdminProduct;
  },

  /** Alterna "disponible" (recibe el valor actual y guarda el contrario). */
  async toggleProductStatus(productId: string, disponible: boolean) {
    const { error } = await supabase
      .from('productos')
      .update({ disponible: !disponible })
      .eq('id', productId);

    if (error) throw error;
  },
};
