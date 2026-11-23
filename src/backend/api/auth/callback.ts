/**
 * [BACKEND · API] Regreso desde Supabase Auth (GET /auth/callback).
 *
 * Supabase redirige aquí con `?code=` (flujo con código: confirmación de correo u OAuth con PKCE).
 * Se canjea el código por una sesión (cookies) y:
 *   - administradores, o usuarios con MFA activado -> /auth/mfa (verificación en dos pasos);
 *   - el resto -> inicio.
 * El login con Google del navegador usa el flujo implícito (tokens en la URL): ese caso lo
 * resuelve la barra superior (frontend/components/common/Navbar.tsx).
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/backend/supabase/server-client';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const [{ data: perfil }, { data: nivel }] = await Promise.all([
        supabase.from('usuarios').select('rol').eq('id', data.session.user.id).maybeSingle(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      const esAdmin = ['admin', 'administrador'].includes(String(perfil?.rol ?? '').toLowerCase());
      const necesitaCodigo = nivel?.nextLevel === 'aal2' && nivel.currentLevel !== 'aal2';
      if (esAdmin || necesitaCodigo) {
        const mfaUrl = new URL('/auth/mfa', requestUrl.origin);
        mfaUrl.searchParams.set('next', esAdmin ? '/admin' : '/');
        return NextResponse.redirect(mfaUrl);
      }
    }
  }

  // Siempre se vuelve al propio sitio (sin parámetros de destino: evita redirecciones abiertas).
  return NextResponse.redirect(requestUrl.origin);
}
