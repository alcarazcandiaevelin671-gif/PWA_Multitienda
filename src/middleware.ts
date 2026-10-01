import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const { data: profile, error } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle();

  const pathname = request.nextUrl.pathname;
  const role = String(profile?.rol ?? '').toLowerCase();
  const isAdminRoute = pathname.startsWith('/admin');
  const isMerchantRoute = pathname.startsWith('/comerciante') || pathname.startsWith('/vendedor');
  const accessError = error || !profile || profile.activo !== true
    ? 'account_inactive'
    : isAdminRoute && !['admin', 'administrador'].includes(role)
      ? 'admin_required'
      : isMerchantRoute && role !== 'comerciante'
        ? 'merchant_required'
        : null;

  if (accessError) {
    const redirect = NextResponse.redirect(new URL(`/auth/login?error=${accessError}`, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
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