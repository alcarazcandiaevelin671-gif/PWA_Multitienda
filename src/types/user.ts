export type UserRole = 'admin' | 'administrador' | 'comerciante' | 'vendedor' | 'cliente';

export interface Usuario {
  id: string;
  email: string;
  nombre_completo?: string | null;
  telefono_contacto?: string | null;
  rol?: 'vendedor' | 'cliente' | 'administrador' | 'admin' | 'comerciante' | null;
  activo?: boolean | null;
}

export interface Tienda {
  id?: string;
  usuario_id?: string | null;
  distrito_id?: number | null;
  nombre_comercio?: string | null;
  slug?: string | null;
  descripcion?: string | null;
}

export interface Distrito {
  identificacion?: number | null;
  departamento_id?: number | null;
  nombre?: string | null;
  activo?: boolean | null;
}

export interface UserProfile {
  id: string; // UUID de Supabase Auth
  email: string;
  nombre_completo: string;
  telefono?: string;
  rol: UserRole;
  distrito_id?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}