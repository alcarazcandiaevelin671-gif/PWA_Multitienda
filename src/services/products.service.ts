import { supabase } from '@/lib/supabase';
import { Product, CreateProductInput } from '@/types/product';

export const productsService = {
  /**
   * Obtiene todos los productos de una tienda específica
   */
  async getProductsByShop(tiendaId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('tienda_id', tiendaId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Crea un nuevo producto
   */
  async createProduct(productData: CreateProductInput): Promise<Product> {
    const { data, error } = await supabase
      .from('productos')
      .insert([{ ...productData, activo: true }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualiza los datos de un producto existente
   */
  async updateProduct(id: string, productData: Partial<CreateProductInput>): Promise<Product> {
    const { data, error } = await supabase
      .from('productos')
      .update(productData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cambia el estado de activación de un producto (Activar / Desactivar)
   */
  async toggleProductStatus(id: string, currentStatus: boolean): Promise<void> {
    const { error } = await supabase
      .from('productos')
      .update({ activo: !currentStatus })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Elimina un producto de la base de datos
   */
  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};