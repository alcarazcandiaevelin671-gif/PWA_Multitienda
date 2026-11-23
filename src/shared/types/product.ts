/**
 * [COMPARTIDO] Tipos de producto usados por el carrito, el precio efectivo y el panel del comerciante.
 */
export interface Product {
  id: string;
  tienda_id: string;
  categoria_id?: number | string | null;
  titulo?: string | null;
  nombre?: string; // Nombre alternativo utilizado en el carrito
  descripcion?: string | null;
  precio?: number | null;
  precio_gs?: number | null;
  precio_oferta?: number | null; // Soporte para ofertas opcionales o nulas
  imagen_url?: string | null;
  destacado?: boolean;
  disponible?: boolean;
  activo?: boolean;
  /** Unidades disponibles; `null`/ausente = el producto no controla stock. */
  stock?: number | null;
  /** Con este stock o menos se avisa al vendedor y se muestra "¡Últimas unidades!". */
  stock_minimo?: number | null;
  /** `true` si la base lo ocultó automáticamente al quedar sin stock. */
  oculto_por_stock?: boolean;
  /** Baja lógica: fecha en que el vendedor lo eliminó (NULL = activo). Nunca se borra de la base. */
  eliminado_en?: string | null;
  created_at?: string;
  creado_en?: string;
}

export type CreateProductInput = Omit<Product, 'id' | 'created_at' | 'creado_en'>;

// Tipo para actualizar un producto existente
export type UpdateProductInput = Partial<CreateProductInput>;