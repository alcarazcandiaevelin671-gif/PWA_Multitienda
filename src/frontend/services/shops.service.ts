/**
 * [FRONTEND] Tiendas del comerciante que inició sesión.
 *
 * Se ejecuta en el navegador con la sesión del usuario (RLS limita a sus propias tiendas).
 * Los comercios destacados del catálogo público se cargan en backend/catalog/shops.ts.
 */
import { supabase } from '@/shared/supabase/client';

export const shopsService = {
  /** Tiendas de un dueño, de la más nueva a la más vieja. */
  async getShopsByOwner(ownerId: string) {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .eq('usuario_id', ownerId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
