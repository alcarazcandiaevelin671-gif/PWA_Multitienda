# frontend/ — código que corre en el navegador

| Carpeta | Contenido |
|---|---|
| `components/` | Componentes de interfaz, agrupados por área: `apariencia`, `cart`, `client`, `common` (barra, pie, notificaciones), `configuracion`, `home`, `orders` (ticket), `products`, `pwa` (offline), `shops`, `ui` |
| `context/` | Estado global de la app (carrito) |
| `hooks/` | Hooks reutilizables (notificaciones en tiempo real) |
| `lib/` | Lógica del navegador: ticket (PDF/QR/WhatsApp), cola de pedidos offline, mensajes globales, geolocalización, recomendaciones |
| `services/` | Acceso a datos con la **sesión del usuario** (Supabase aplica RLS). Las operaciones sensibles llaman a `/api/...` |
| `styles/` | `globals.css`: estilos globales, tema dinámico (variables CSS), modo oscuro e impresión del ticket |

Reglas:

- **No importar nada de `src/backend/`**: el build falla (`server-only`).
- Para datos compartidos con el servidor usa `src/shared/`.
- Archivos con `'use client'` en la primera línea son componentes del navegador.

Ver `docs/ARQUITECTURA.md`.
