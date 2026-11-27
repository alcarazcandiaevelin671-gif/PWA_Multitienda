const isDev = process.env.NODE_ENV !== 'production';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';

/**
 * Content-Security-Policy (OWASP ASVS V14.4 / ISO 27002 8.26).
 * - Scripts: solo del propio sitio. 'unsafe-inline' es necesario para los scripts de
 *   hidratación que genera Next.js 14 y el script de apariencia; bloquea igual cualquier
 *   script de otro dominio inyectado. 'unsafe-eval' solo en desarrollo (recarga en caliente).
 * - Conexiones: propio sitio + Supabase (API, Auth, Realtime por WebSocket, Storage).
 * - Imágenes: propio sitio, Storage de Supabase y mosaicos de OpenStreetMap y foto de perfil de Google.
 * - Sin iframes de terceros, sin plugins, formularios solo hacia el propio sitio.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseHost ? `https://${supabaseHost}` : ''} https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://lh3.googleusercontent.com`,
  "font-src 'self' data:",
  // Los mosaicos del mapa también en connect-src: el service worker los descarga con fetch() para la caché offline.
  `connect-src 'self' ${supabaseHost ? `https://${supabaseHost} wss://${supabaseHost}` : ''} https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://nominatim.openstreetmap.org`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Sin upgrade-insecure-requests: rompería el servidor local por HTTP; en producción HSTS obliga HTTPS.
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // HTTPS obligatorio por 2 años, incluidos subdominios (solo tiene efecto servido por HTTPS).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Solo la geolocalización (mapa de tiendas / entrega) y para el propio sitio.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite compilar producción en otra carpeta sin pisar el servidor de desarrollo (.next).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // No revelar la tecnología del servidor (X-Powered-By: Next.js).
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vibirkodivyrmhrxlihc.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Respuestas de la API con datos personales: nunca en cachés compartidas.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        // El service worker siempre se revisa en la red para que las actualizaciones lleguen.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },
};

export default nextConfig;
