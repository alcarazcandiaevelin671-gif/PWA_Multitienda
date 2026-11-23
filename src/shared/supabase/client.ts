/**
 * [COMPARTIDO] Cliente de Supabase con la clave pública (RLS aplica siempre) y getClientUser(): usuario de la sesión local sin ir a la red.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Usuario de la sesión guardada en el dispositivo, sin consultar a Supabase (auth.getUser() hace
 * un viaje de red de ~0.3 s en cada llamada). Misma forma de respuesta que auth.getUser().
 * La seguridad de los datos no cambia: RLS valida el token en cada consulta del lado de Supabase.
 */
export async function getClientUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { data: { user: session?.user ?? null }, error };
}
