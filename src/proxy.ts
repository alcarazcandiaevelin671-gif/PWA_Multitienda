/**
 * Punto de entrada del proxy de Next.js (convención: debe llamarse src/proxy.ts).
 * La lógica está en src/backend/security/proxy.ts. Aquí solo se declara en qué rutas se ejecuta:
 * Next.js necesita leer `config` escrito literalmente en este archivo.
 */
export { proxy } from '@/backend/security/proxy';

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
