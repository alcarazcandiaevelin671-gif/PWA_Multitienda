export interface Shop {
  id: string;
  nombre: string;
  slug: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
  whatsapp?: string;
  email?: string;
  logo_url?: string;
  portada_url?: string;
  distrito_id?: string;
  usuario_id?: string; // Propietario / Comerciante
  latitud?: number;
  longitud?: number;
  activo: boolean;
  created_at?: string;
}

export type CreateShopInput = Omit<Shop, 'id' | 'created_at' | 'activo'>;