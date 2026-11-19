import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ROLE_COOKIE, getAccountProfile, getVerifiedUser, roleCookieOptions } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Protección de la API: origen (CSRF) y límite de peticiones. La autorización la hace cada ruta. */
function protectApi(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSRF: un navegador siempre envía Origin en peticiones que modifican datos.
  // Si viene de otro sitio, se rechaza (defensa adicional a las cookies SameSite=Lax).
  if (!SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: 'Origen de la solicitud no permitido.' }, { status: 403 });
    }
  }

  // Next 16 ya no expone request.ip: se usa la IP que informa el proxy/hosting.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'local';
  const result = checkRateLimit(pathname, ip);
  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' },
      { status: 429, headers: { 'Retry-After': String(result.retryAfterSec), 'X-RateLimit-Limit': String(result.limit), 'X-RateLimit-Remaining': '0' } },
    );
  }
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  return response;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) return protectApi(request);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Firma del token verificada localmente (sin viaje a Supabase salvo al renovar la sesión).
  const user = await getVerifiedUser(supabase);
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  // Rol desde la cookie firmada (2 min); si venció, una consulta a usuarios y se renueva.
  let roleCookie: string | null = null;
  const profile = await getAccountProfile(supabase, user.id, request.cookies.get(ROLE_COOKIE)?.value, (value) => { roleCookie = value; });

  const pathname = request.nextUrl.pathname;
  const role = profile?.rol ?? '';
  const isAdminRoute = pathname.startsWith('/admin');
  const isMerchantRoute = pathname.startsWith('/comerciante') || pathname.startsWith('/vendedor');
  const accessError = !profile || profile.activo !== true
    ? 'account_inactive'
    : isAdminRoute && !['admin', 'administrador'].includes(role)
      ? 'admin_required'
      : isMerchantRoute && role !== 'comerciante'
        ? 'merchant_required'
        : null;

  if (accessError) {
    const redirect = NextResponse.redirect(new URL(`/auth/login?error=${accessError}`, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.cookies.delete(ROLE_COOKIE);
    return redirect;
  }

  // MFA obligatorio para administración: la sesión debe haber verificado el código TOTP (aal2).
  if (isAdminRoute && user.aal !== 'aal2') {
    const mfaUrl = new URL('/auth/mfa', request.url);
    mfaUrl.searchParams.set('next', pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(mfaUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    if (roleCookie) redirect.cookies.set(ROLE_COOKIE, roleCookie, roleCookieOptions);
    return redirect;
  }

  if (roleCookie) response.cookies.set(ROLE_COOKIE, roleCookie, roleCookieOptions);
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/comerciante/:path*',
    '/vendedor/:path*',
    '/checkout',
    '/pedidos/:path*',
    '/facturas/:path*',
    '/perfil',
    '/configuracion',
  ],
};
