# Arquitectura del proyecto

El código está separado en **frontend**, **backend** y **compartido**. Next.js obliga a que las
rutas vivan en `src/app/`, así que esa carpeta es solo la **capa de enrutamiento**: las páginas
dibujan la interfaz y los endpoints de la API delegan toda su lógica en `src/backend/`.

```
PWA_Multitienda/
├── src/
│   ├── app/                 ENRUTAMIENTO (Next.js App Router)
│   │   ├── **/page.tsx      Páginas: una por URL (interfaz)
│   │   ├── **/layout.tsx    Estructura compartida por varias páginas
│   │   ├── api/**/route.ts  "Puertas" de la API: 1 línea que reexporta src/backend/api/…
│   │   └── auth/callback/   Regreso desde Supabase Auth (también delega en el backend)
│   ├── proxy.ts             Punto de entrada del proxy (qué rutas protege). Lógica: backend/security/proxy.ts
│   │
│   ├── frontend/            CORRE EN EL NAVEGADOR
│   │   ├── components/      Componentes de interfaz agrupados por área
│   │   ├── context/         Estado global (carrito)
│   │   ├── hooks/           Hooks reutilizables
│   │   ├── lib/             Lógica del navegador: ticket, cola offline, mensajes, geolocalización
│   │   ├── services/        Acceso a datos con la sesión del usuario (Supabase + RLS)
│   │   └── styles/          CSS global y del tema dinámico
│   │
│   ├── backend/             CORRE SOLO EN EL SERVIDOR (marcado con `import 'server-only'`)
│   │   ├── api/             Lógica de cada endpoint (/api/…)
│   │   ├── auth/            Verificación de sesión, rol, cuenta activa y MFA
│   │   ├── security/        Proxy (CSRF, rutas protegidas) y límite de peticiones
│   │   ├── catalog/         Datos del catálogo para páginas que se generan en el servidor
│   │   └── supabase/        Clientes de servidor (con sesión del usuario / con clave secreta)
│   │
│   └── shared/              LO USAN AMBOS LADOS (sin secretos)
│       ├── lib/             Apariencia/temas, precios, mensajes de error
│       ├── supabase/        Cliente público de Supabase (clave anónima/publishable)
│       └── types/           Tipos de TypeScript
│
├── public/                  Archivos estáticos: service worker, manifest, íconos, íconos del mapa
├── supabase/migrations/     Cambios de la base de datos (SQL), en orden de fecha
├── scripts/backup/          Copias de seguridad y prueba de restauración
├── .github/workflows/       Tareas automáticas (copia diaria de la base)
└── docs/                    Documentación (seguridad, copias, MFA, arquitectura, modelo de datos)
```

## Reglas de dependencia

| Desde \ puede importar | `frontend/` | `backend/` | `shared/` |
|---|---|---|---|
| **Páginas cliente** (`'use client'`) y **`frontend/`** | ✅ | ❌ **(el build falla)** | ✅ |
| **Páginas servidor**, **`api/`**, **`proxy.ts`** y **`backend/`** | ✅ solo componentes (para dibujar) | ✅ | ✅ |
| **`shared/`** | ❌ | ❌ | ✅ |

- `backend/` nunca debe llegar al navegador: todos sus archivos empiezan con `import 'server-only'`,
  y Next.js **detiene el build** si un componente del navegador los importa (comprobado).
- `shared/` no contiene secretos ni lógica de un solo lado: solo tipos, utilidades puras y el
  cliente público de Supabase.
- La clave secreta (`SUPABASE_SERVICE_ROLE_KEY`) solo se usa en `backend/supabase/admin-client.ts`.

## Cómo fluye una petición

**Página pública generada en el servidor** (p. ej. `/tiendas`):
`app/tiendas/page.tsx` → `backend/catalog/products.ts` → Supabase → HTML (caché de 30 s).

**Acción del usuario en el navegador** (p. ej. ver sus pedidos):
componente → `frontend/services/orders.service.ts` → Supabase con la sesión del usuario (RLS).

**Operación sensible** (p. ej. confirmar compra):
`frontend/services/orders.service.ts` → `POST /api/checkout` → `src/proxy.ts` (CSRF + límite)
→ `app/api/checkout/route.ts` → `backend/api/checkout.ts` (valida, verifica sesión) → función SQL.

**Página privada** (p. ej. `/admin`):
`src/proxy.ts` → `backend/security/proxy.ts` (sesión, rol, cuenta activa, MFA) → página.

## Dónde agregar algo nuevo

| Quiero… | Lugar |
|---|---|
| Una pantalla nueva | `src/app/<ruta>/page.tsx` (+ componentes en `src/frontend/components/<área>/`) |
| Leer/escribir datos del usuario desde el navegador | `src/frontend/services/<tema>.service.ts` |
| Un endpoint con lógica de servidor o secretos | lógica en `src/backend/api/<nombre>.ts` + 1 línea en `src/app/api/<nombre>/route.ts` |
| Datos para una página del servidor | `src/backend/catalog/` |
| Un tipo usado en varios lugares | `src/shared/types/` |
| Proteger una ruta nueva | `matcher` de `src/proxy.ts` y reglas en `src/backend/security/proxy.ts` |
| Un cambio en la base de datos | `supabase/migrations/AAAAMMDDHHMMSS_descripcion.sql` |

## Componentes sin uso actualmente

Se conservan (no se borró funcionalidad) pero ninguna página los usa hoy:
`frontend/components/client/PerfilRolGate.tsx`, `frontend/components/client/PerfilCliente.tsx`,
`frontend/components/shops/GeolocatedShopDirectory.tsx`, `frontend/services/products.service.ts`
(CRUD de productos del comerciante) y `frontend/services/shops.service.ts`.
