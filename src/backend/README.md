# backend/ — código que corre solo en el servidor

Todos los archivos empiezan con `import 'server-only'`: si un componente del navegador los
importa, **Next.js detiene el build**. Aquí viven la lógica sensible y los secretos.

| Carpeta | Contenido |
|---|---|
| `api/` | Lógica de cada endpoint. `src/app/api/<ruta>/route.ts` solo reexporta el archivo correspondiente |
| `auth/` | `server-auth.ts` (firma de sesión verificada localmente, cookie de rol firmada) y guardias: `require-admin`, `require-merchant`, `require-active-user` |
| `security/` | `proxy.ts` (CSRF, rutas protegidas, rol, MFA) y `rate-limit.ts` (límite de peticiones) |
| `catalog/` | Datos del catálogo público para páginas que se generan en el servidor (tiendas, productos, categorías, vitrina) |
| `supabase/` | `server-client.ts` (con la sesión del usuario, RLS aplica) y `admin-client.ts` (clave secreta: salta RLS, usar lo mínimo) |

## Endpoints

| Ruta pública | Archivo |
|---|---|
| `POST /api/checkout` | `api/checkout.ts` |
| `GET /api/recommendations` | `api/recommendations.ts` |
| `POST /api/registro-vendedor` · `/api/registro-comerciante` | `api/registro-vendedor.ts` |
| `POST/DELETE /api/auth/session` | `api/auth/session.ts` |
| `GET /auth/callback` | `api/auth/callback.ts` |
| `GET/PATCH /api/configuracion` | `api/configuracion/preferencias.ts` |
| `PATCH /api/configuracion/identidad` | `api/configuracion/identidad.ts` |
| `POST/DELETE /api/configuracion/foto` | `api/configuracion/foto.ts` |
| `GET /api/configuracion/exportar-datos` | `api/configuracion/exportar-datos.ts` |
| `POST /api/configuracion/desactivar` | `api/configuracion/desactivar.ts` |
| `GET /api/admin/dashboard` | `api/admin/dashboard.ts` |
| `GET/PATCH /api/admin/:recurso` | `api/admin/recursos.ts` |
| `GET/PATCH /api/admin/:recurso/:id` | `api/admin/recurso.ts` |
| `POST /api/admin/comercios/:id/approve` · `reject` | `api/admin/comercio-aprobar.ts` · `comercio-rechazar.ts` |
| `GET /api/admin/reportes` | `api/admin/reportes.ts` (retirado: 410) |

Para agregar un endpoint: crea la lógica en `api/<nombre>.ts` y una línea en
`src/app/api/<nombre>/route.ts`: `export { POST } from '@/backend/api/<nombre>';`

Ver `docs/ARQUITECTURA.md`.
