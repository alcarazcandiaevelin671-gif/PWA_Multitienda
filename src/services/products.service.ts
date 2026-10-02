import { supabase } from '@/lib/supabase';
import type { Product as AdminProduct } from '@/types/product';

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

export interface FeaturedProduct extends Product {
  precio_oferta?: number | null;
  tienda?: {
    nombre_comercio: string | null;
    slug: string | null;
    latitud?: number | null;
    longitud?: number | null;
    distrito_id?: number | null;
  } | null;
}

export interface ProductDistrict {
  id: number;
  nombre: string;
}

export async function getProductDistricts(): Promise<ProductDistrict[]> {
  const { data, error } = await supabase
    .from('distritos')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error al obtener distritos disponibles:', error);
    return [];
  }

  return (data || []).filter((district): district is ProductDistrict => district.id !== null && district.nombre !== null);
}

export async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('id, tienda_id, titulo, descripcion, precio_gs, precio_oferta, imagen_url, categoria_id, creado_en, tienda:tiendas(nombre_comercio, slug, latitud, longitud, distrito_id)')
    .eq('disponible', true)
    .order('creado_en', { ascending: false })
    .limit(60);

  if (error) {
    console.error('Error al obtener productos disponibles:', error);
    return [];
  }

  return (data || []) as unknown as FeaturedProduct[];
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

export const productsService = {
  async getProductsByShop(shopId: string): Promise<AdminProduct[]> {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('tienda_id', shopId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as AdminProduct[];
  },
  async createProduct(product: Omit<AdminProduct, 'id' | 'created_at'>) {
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
  async toggleProductStatus(productId: string, activo: boolean) {
    const { error } = await supabase
      .from('productos')
      .update({ activo: !activo })
      .eq('id', productId);

    if (error) throw error;
  },
};