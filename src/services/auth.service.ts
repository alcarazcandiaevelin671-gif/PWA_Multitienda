import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types/user';

export const authService = {
  /**
   * Inicia sesión con correo y contraseña para cualquier rol (Cliente, Comerciante, Admin)
   */
  async signIn(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Inicia sesión o se registra automáticamente utilizando la cuenta de Google
   */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Registro completo para Comerciantes con la creación inicial de su Tienda
   */
  async signUpComerciante(params: {
    email: string;
    pass: string;
    nombreCompleto: string;
    telefono: string;
    nombreTienda: string;
    distritoId?: string;
    direccionTienda?: string;
  }) {
    // 1. Crear usuario en Supabase Auth con metadatos
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: params.pass,
      options: {
        data: {
          nombre_completo: params.nombreCompleto,
          rol: 'comerciante',
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No se pudo crear la cuenta de usuario');

    const userId = authData.user.id;

    // 2. Insertar registro del usuario en la tabla 'usuarios'
    const { error: userError } = await supabase.from('usuarios').insert([
      {
        id: userId,
        email: params.email,
        nombre_completo: params.nombreCompleto,
        telefono: params.telefono,
        rol: 'comerciante' as UserRole,
      },
    ]);

    if (userError) console.error('Error guardando perfil de usuario:', userError);

    // 3. Crear automáticamente la Tienda vinculada a este usuario
    const { error: shopError } = await supabase.from('tiendas').insert([
      {
        usuario_id: userId,
        nombre: params.nombreTienda,
        slug: params.nombreTienda.toLowerCase().trim().replace(/[\s\W]+/g, '-'),
        telefono: params.telefono,
        whatsapp: params.telefono,
        direccion: params.direccionTienda,
        distrito_id: params.distritoId || null,
        estado: 'activa',
      },
    ]);

    if (shopError) console.error('Error registrando la tienda:', shopError);

    return authData.user;
  },

  /**
   * Cierra la sesión activa
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Obtiene los datos del usuario logueado junto con su Rol
   */
  async getCurrentProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single();

    return data;
  },
};