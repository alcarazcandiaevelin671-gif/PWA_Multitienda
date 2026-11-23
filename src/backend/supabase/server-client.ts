/**
 * [BACKEND] Cliente de Supabase para el servidor con la sesión del usuario (cookies). Único punto donde se crea; RLS aplica normalmente.
 *
 * Auditoría: cuando el servidor habla con Supabase en nombre de un visitante, Supabase ve la IP del
 * servidor, no la del visitante. Por eso se reenvían la IP y el navegador reales en las cabeceras
 * `x-client-ip` y `x-client-user-agent`; los triggers de auditoría las guardan en `auditorias.ip_cliente`
 * y `auditorias.user_agent` (ver supabase/migrations/20261123120000_ofertas_stock_auditoria.sql).
 */
import 'server-only';
import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

/** IP y navegador del visitante, para que los logs de la base digan desde dónde se hizo cada cambio. */
async function clientContextHeaders(): Promise<Record<string, string>> {
  try {
    const requestHeaders = await headers();
    const ip = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip')?.trim();
    const userAgent = requestHeaders.get('user-agent')?.slice(0, 300);
    const result: Record<string, string> = {};
    if (ip) result['x-client-ip'] = ip.slice(0, 64);
    if (userAgent) result['x-client-user-agent'] = userAgent;
    return result;
  } catch {
    return {}; // fuera de una petición (build): sin cabeceras
  }
}

export async function createSupabaseServerClient() {
  const [cookieStore, contextHeaders] = await Promise.all([cookies(), clientContextHeaders()]);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: contextHeaders },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Los componentes de servidor no permiten modificar cookies.
          }
        },
      },
    }
  );
}