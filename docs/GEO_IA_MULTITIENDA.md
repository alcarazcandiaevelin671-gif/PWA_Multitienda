# Mapa de comercios, IA y carrito multitienda

## Mapa de comercios (`/comercios`)

- Leaflet + OpenStreetMap: gratuito y sin clave de API. Los mosaicos se guardan en caché (service worker).
- `tiendas_cercanas(lat, lng, radio_km, distrito_id, categoria)` (PostgreSQL/PostGIS, migración `20261124140000`):
  - distancia geodésica con `ST_Distance`;
  - radio con `ST_DWithin`, que usa el índice GIST `idx_tiendas_geo`.
- Sin conexión, la distancia se calcula en el navegador con Haversine (`shops-map.service.ts`).
- Ubicación **con consentimiento** (`frontend/lib/location-consent.ts`):
  - pantalla propia;
  - se guarda solo en el dispositivo por 30 minutos;
  - se puede "Olvidar mi ubicación".

## Motor de recomendación (`src/backend/recommendations/engine.ts`)

| Señal | Peso | Detalle |
|---|---|---|
| Contenido | 0,45 | TF-IDF + similitud coseno (título, descripción, categoría) |
| Colaborativo ítem-ítem | 0,30 | co(i,j)/√(nᵢ·nⱼ) sobre cestas anónimas (`recomendacion_cestas()`, solo servidor) |
| Popularidad | 0,15 | unidades vendidas (`productos_mas_comprados`) |
| Cercanía | 0,10 | 1 − d/30 km con distancia PostGIS |

- **Arranque en frío** (usuario sin historial): popularidad 0,6 + cercanía 0,4, con diversidad de categorías.
- **Imparcialidad**: máximo 2 productos por comercio, y cada sugerencia trae su `motivo`.
- **Salidas** de `GET /api/recommendations`: `tipo=productos`, `tipo=comercios` y `tipo=complementarios`.
- **Evaluación**: `node scripts/ia/evaluar-recomendaciones.mjs`. Usa leave-one-out con HitRate@5, Precision@5, NDCG@5 y MRR, y escribe los resultados en `docs/evaluacion/ia-resultados.md`.

## Carrito multitienda

- `CartContext` acepta productos de varios comercios y los agrupa en `shopGroups`.
- `frontend/lib/multi-store-checkout.ts` crea **un pedido por comercio**. Si se corta la conexión, los pedidos pendientes pasan a la cola offline.
- `/pedidos/enviar?ids=…` muestra un ticket y un botón de WhatsApp por comercio.

## Evidencias de la tesis (`docs/evaluacion/`)

| Archivo o carpeta | Contenido |
|---|---|
| `e2e-resultados.json` + `capturas/` | 26 pruebas funcionales automatizadas |
| `lighthouse/` | `node scripts/evaluacion/lighthouse.mjs`: 3 corridas por página, mediana |
| `ia-resultados.md` | Evaluación del motor de IA |
| `geolocalizacion-precision.txt` | Comparación PostGIS vs Haversine |
| `diagramas/` | Figuras del Capítulo IV |
