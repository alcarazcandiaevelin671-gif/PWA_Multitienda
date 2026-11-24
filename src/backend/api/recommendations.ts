/**
 * [BACKEND · API] Recomendaciones con IA (GET /api/recommendations).
 *
 * Ruta pública: src/app/api/recommendations/route.ts (solo reexporta este archivo).
 * El algoritmo está en src/backend/recommendations/engine.ts (híbrido: TF-IDF + coseno, filtrado
 * colaborativo ítem-ítem, popularidad y cercanía con PostGIS). Aquí solo se juntan los datos.
 *
 * Parámetros (query):
 *   tipo            productos (por defecto) | comercios | complementarios
 *   favoriteId      productos favoritos del usuario (repetible)
 *   purchasedId     productos comprados (repetible)
 *   contextId       productos que está viendo o tiene en el carrito (repetible; alias: productId)
 *   searchTerm      búsquedas recientes (repetible)
 *   categoryId      categorías buscadas (repetible)
 *   favoriteShopId  comercios favoritos (repetible)
 *   lat, lng        ubicación (opcional): la distancia la calcula PostGIS y NO se guarda
 *   limit           1 a 20
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/shared/supabase/client';
import { createAdminClient } from '@/backend/supabase/admin-client';
import { userFacingError } from '@/shared/lib/user-facing-error';
import {
  buildModel,
  complementaryProducts,
  recommendProducts,
  recommendShops,
  type EngineProduct,
  type ScoredProduct,
  type UserSignals,
} from '@/backend/recommendations/engine';

type CatalogRow = {
  id: string;
  tienda_id: string;
  titulo: string | null;
  nombre: string | null;
  descripcion: string | null;
  categoria_id: number | null;
  precio_gs: number | null;
  precio_oferta: number | null;
  imagen_url: string | null;
};

type ShopRow = {
  id: string;
  slug: string | null;
  nombre_comercio: string | null;
  categoria_principal: string | null;
  logo_url: string | null;
  distrito: string | null;
  distancia_km: number | null;
  total_productos: number;
};

const ids = (values: string[]) => [...new Set(values.filter((value) => /^[0-9a-f-]{36}$/i.test(value)))].slice(0, 30);

function parseLimit(value: string | null): number {
  const limit = Number(value || 6);
  return Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 20) : 6;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tipo = params.get('tipo') || 'productos';
  const limit = parseLimit(params.get('limit'));
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const hasLocation = params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  try {
    // 1) Datos: catálogo, categorías, comercios activos con distancia (PostGIS), ventas y cestas
    const admin = createAdminClient();
    const [catalogResult, categoriesResult, shopsResult, popularityResult, basketsResult] = await Promise.all([
      supabase
        .from('productos')
        .select('id, tienda_id, titulo, nombre, descripcion, categoria_id, precio_gs, precio_oferta, imagen_url')
        .eq('disponible', true),
      supabase.from('categorias').select('id, nombre'),
      supabase.rpc('tiendas_cercanas', hasLocation ? { p_lat: lat, p_lng: lng } : {}),
      supabase.rpc('productos_mas_comprados', { p_limit: 200 }),
      admin ? admin.rpc('recomendacion_cestas') : Promise.resolve({ data: [], error: null }),
    ]);
    if (catalogResult.error) throw catalogResult.error;
    if (shopsResult.error) throw shopsResult.error;

    const categoryNames = new Map(((categoriesResult.data || []) as Array<{ id: number; nombre: string }>).map((c) => [c.id, c.nombre]));
    const shops = (shopsResult.data || []) as ShopRow[];
    const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
    // Solo productos de comercios activos
    const catalog = ((catalogResult.data || []) as CatalogRow[]).filter((row) => shopsById.has(row.tienda_id));
    const catalogById = new Map(catalog.map((row) => [row.id, row]));

    const products: EngineProduct[] = catalog.map((row) => {
      const categoria = row.categoria_id != null ? categoryNames.get(row.categoria_id) ?? null : null;
      return {
        id: row.id,
        tienda_id: row.tienda_id,
        texto: [row.nombre || row.titulo, row.descripcion, categoria, shopsById.get(row.tienda_id)?.categoria_principal]
          .filter(Boolean).join(' · '),
        categoria,
      };
    });

    const model = buildModel({
      products,
      baskets: ((basketsResult.data || []) as Array<{ productos: string[] }>).map((row) => row.productos),
      popularity: new Map(((popularityResult.data || []) as Array<{ producto_id: string; unidades: number }>)
        .map((row) => [row.producto_id, Number(row.unidades) || 0])),
      shopDistanceKm: new Map(shops.filter((shop) => shop.distancia_km != null).map((shop) => [shop.id, Number(shop.distancia_km)])),
    });

    // 2) Señales del usuario (las arma el navegador con sus propios datos; ver recommendations-client.ts)
    const signals: UserSignals = {
      favoriteIds: ids(params.getAll('favoriteId')),
      purchasedIds: ids(params.getAll('purchasedId')),
      contextIds: ids([...params.getAll('contextId'), ...params.getAll('productId')]),
      searchTerms: params.getAll('searchTerm').map((term) => term.trim().slice(0, 60)).filter(Boolean).slice(0, 20),
      categoryNames: params.getAll('categoryId').map((id) => categoryNames.get(Number(id))).filter((name): name is string => Boolean(name)),
      favoriteShopIds: ids(params.getAll('favoriteShopId')),
    };

    const toProductResponse = (item: ScoredProduct) => {
      const row = catalogById.get(item.id)!;
      const shop = shopsById.get(row.tienda_id);
      return {
        id: row.id,
        nombre: row.nombre || row.titulo || 'Producto',
        precio: Number(row.precio_gs || 0),
        precio_oferta: row.precio_oferta == null ? null : Number(row.precio_oferta),
        imagen_url: row.imagen_url || null,
        tienda_id: row.tienda_id,
        tienda_slug: shop?.slug || null,
        tienda_nombre: shop?.nombre_comercio || null,
        distancia_km: shop?.distancia_km ?? null,
        similarity_score: Number(item.score.toFixed(4)),
        motivo: item.motivo,
      };
    };

    // 3) Respuesta según el tipo pedido
    if (tipo === 'comercios') {
      const shopCategories = new Map(shops.map((shop) => [shop.id, shop.categoria_principal]));
      return NextResponse.json(recommendShops(model, signals, shopCategories, limit).map((item) => {
        const shop = shopsById.get(item.tienda_id)!;
        return { ...shop, score: Number(item.score.toFixed(4)), motivo: item.motivo };
      }));
    }

    if (tipo === 'complementarios') {
      return NextResponse.json(complementaryProducts(model, signals.contextIds, limit).map(toProductResponse));
    }

    return NextResponse.json(recommendProducts(model, signals, { limit }).map(toProductResponse));
  } catch (error: any) {
    console.error('Error generando recomendaciones:', error);
    return NextResponse.json(
      { error: userFacingError(error, 'No se pudieron generar recomendaciones. Inténtalo de nuevo.') },
      { status: 500 },
    );
  }
}
