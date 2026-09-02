export type UserRole = 'admin' | 'comerciante' | 'cliente';

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