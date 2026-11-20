import { supabase } from '@/lib/supabase/client';
import type { Categoria, Producto, PlanSuscripcion, Tienda } from '@/types/database';

export const obtenerCategorias = async (): Promise<Categoria[]> => {
  const { data, error } = await supabase.from('categorias').select('*');

  if (error) {
    console.error('Error al obtener categorías:', error);
    return [];
  }

  return data?.map((item) => item as Categoria) ?? [];
};

export const obtenerProductosPorTienda = async (tiendaId: string): Promise<Producto[]> => {
  const { data, error } = await supabase.from('productos').select('*').eq('tienda_id', tiendaId);

  if (error) {
    console.error('Error al obtener productos por tienda:', error);
    return [];
  }

  return data?.map((item) => item as Producto) ?? [];
};

export const obtenerPlanesSuscripcion = async (): Promise<PlanSuscripcion[]> => {
  const { data, error } = await supabase.from('planes_suscripcion').select('*');

  if (error) {
    console.error('Error al obtener planes de suscripción:', error);
    return [];
  }

  return data?.map((item) => item as PlanSuscripcion) ?? [];
};

export const obtenerTiendaPorUsuario = async (usuarioId: string): Promise<Tienda | null> => {
  const { data, error } = await supabase.from('tiendas').select('*').eq('usuario_id', usuarioId).maybeSingle();

  if (error) {
    console.error('Error al obtener tienda por usuario:', error);
    return null;
  }

  return data ? (data as Tienda) : null;
};
