export interface Product {
  id: string;
  tienda_id: string;
  categoria_id?: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  precio_oferta?: number;
  stock: number;
  imagen_url?: string;
  destacado?: boolean;
  activo: boolean;
  created_at?: string;
}

export type CreateProductInput = Omit<Product, 'id' | 'created_at'>;