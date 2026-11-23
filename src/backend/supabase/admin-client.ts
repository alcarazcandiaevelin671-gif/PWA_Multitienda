/**
 * [BACKEND] Cliente de Supabase con la clave secreta del servidor (SUPABASE_SERVICE_ROLE_KEY).
 *
 * ⚠️ Esta clave salta las políticas RLS: úsalo solo en el servidor y solo cuando sea
 * imprescindible (registro de comerciantes, catálogo público destacado). `server-only`
 * hace fallar el build si alguien lo importa desde un componente del navegador.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Devuelve un cliente con privilegios de servidor, o `null` si la clave no está configurada
 * (así quien lo usa puede decidir un plan alternativo o responder un error claro).
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
