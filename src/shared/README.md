# shared/ — código que usan el frontend y el backend

Solo tipos, utilidades puras y el cliente **público** de Supabase. **Nunca** secretos ni lógica
que dependa de un solo lado. No importa nada de `frontend/` ni de `backend/`.

| Carpeta | Contenido |
|---|---|
| `lib/appearance.ts` | Temas, paletas, contraste y aplicación de la apariencia (lo usan el panel "Personalizar" y la API de configuración) |
| `lib/product-pricing.ts` | Precio efectivo, precio tachado y % de descuento (ofertas), "últimas unidades" y máximo por stock. Ver `docs/OFERTAS_STOCK_LOGS.md` |
| `lib/user-facing-error.ts` | Errores técnicos → mensajes claros en español |
| `supabase/client.ts` | Cliente de Supabase con la clave pública (RLS aplica siempre) y `getClientUser()` |
| `types/` | Tipos de TypeScript: base de datos, catálogo, producto, tienda, carrito |

Ver `docs/ARQUITECTURA.md`.
