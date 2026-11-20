import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Manejo silencioso en Server Components
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // Inicio con Google (u otro proveedor) o confirmación de correo: igual que con contraseña,
    // los administradores pasan por la verificación en dos pasos, y también quien ya activó MFA.
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

  return NextResponse.redirect(requestUrl.origin);
}