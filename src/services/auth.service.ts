import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types/user';

export const authService = {
  async signIn(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) throw error;
    return data;
  },

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

  async signUpComerciante(params: {
    email: string;
    pass: string;
    nombreCompleto: string;
    telefono: string;
    nombreTienda: string;
    distritoId?: string;
    direccionTienda?: string;
  }) {
    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.email,
      password: params.pass,
      options: {
        data: {
          nombre_completo: params.nombreCompleto,
          rol: 'vendedor',
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No se pudo crear la cuenta de usuario');

    const userId = authData.user.id;

    // 2. Insertar registro en 'usuarios'
    const { error: userError } = await supabase.from('usuarios').upsert(
      {
        identificacion: userId,
        correo_electronico: params.email,
        nombre_completo: params.nombreCompleto,
        telefono_contacto: params.telefono,
        rol: 'vendedor' as UserRole,
        activo: true,
      },
      { onConflict: 'identificacion' }
    );

    if (userError) console.error('Error guardando perfil de usuario:', userError);

    // 3. Crear Tienda con los campos SQL correctos
    const { error: shopError } = await supabase.from('tiendas').insert([
      {
        usuario_id: userId, // ✅ UUID de la tabla usuarios
        nombre_comercio: params.nombreTienda, // ✅ Corregido (antes 'nombre')
        slug: params.nombreTienda.toLowerCase().trim().replace(/[\s\W]+/g, '-'),
        telefono: params.telefono,
        whatsapp: params.telefono,
        direccion_texto: params.direccionTienda, // ✅ Corregido (antes 'direccion')
        distrito_id: params.distritoId || null,
        estado: 'pendiente', // ✅ Corregido según el ENUM de la BD
      },
    ]);

    if (shopError) console.error('Error registrando la tienda:', shopError);

    return authData.user;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('identificacion', session.user.id)
      .maybeSingle();

    return data;
  },
};