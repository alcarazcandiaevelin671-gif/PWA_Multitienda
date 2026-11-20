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
  stock?: number;
  created_at?: string;
  creado_en?: string;
}

export type CreateProductInput = Omit<Product, 'id' | 'created_at' | 'creado_en'>;

// Tipo para actualizar un producto existente
export type UpdateProductInput = Partial<CreateProductInput>;