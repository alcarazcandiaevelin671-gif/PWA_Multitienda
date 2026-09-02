import { supabase } from '@/lib/supabase';
import { Shop, CreateShopInput } from '@/types/shop';

/**
 * Función que ya tenía tu compañera para la página principal
 */
export async function getFeaturedShops() {
  try {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .eq('estado', 'activa')
      .limit(8);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error cargando tiendas desde Supabase:', error);
    return [];
  }
}

/**
 * Servicio unificado para la gestión de comercios
 */
export const shopsService = {
  /**
   * Obtiene todos los comercios activos (usando el campo 'estado' de tu BD)
   */
  async getActiveShops(): Promise<Shop[]> {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .eq('estado', 'activa')
      .order('nombre', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Obtiene un comercio por su ID
   */
  async getShopById(id: string): Promise<Shop | null> {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Obtiene las tiendas pertenecientes a un comerciante/usuario específico
   */
  async getShopsByOwner(userId: string): Promise<Shop[]> {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Crea un nuevo comercio
   */
  async createShop(shopData: CreateShopInput): Promise<Shop> {
    const { data, error } = await supabase
      .from('tiendas')
      .insert([{ ...shopData, estado: 'activa' }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualiza un comercio existente
   */
  async updateShop(id: string, shopData: Partial<CreateShopInput>): Promise<Shop> {
    const { data, error } = await supabase
      .from('tiendas')
      .update(shopData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cambia el estado a inactiva (Soft Delete)
   */
  async deleteShop(id: string): Promise<void> {
    const { error } = await supabase
      .from('tiendas')
      .update({ estado: 'inactiva' })
      .eq('id', id);

    if (error) throw error;
  }
};