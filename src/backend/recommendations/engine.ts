/**
 * [BACKEND] Motor de recomendación HÍBRIDO (módulo puro, sin acceso a red ni a la base).
 *
 * Combina cuatro señales, cada una normalizada entre 0 y 1:
 *   1. Contenido (TF-IDF + similitud coseno): parecido del texto del producto (título, descripción,
 *      categoría) con lo que el usuario marcó como favorito, compró, está viendo o buscó.
 *   2. Colaborativo ítem-ítem: productos que aparecen JUNTOS en los mismos pedidos o en los favoritos
 *      de un mismo usuario. sim(i, j) = co(i, j) / √(n_i · n_j)  (coseno sobre la matriz de co-ocurrencia).
 *   3. Popularidad: unidades vendidas, normalizadas por el producto más vendido.
 *   4. Cercanía: distancia real al comercio calculada por PostGIS (tiendas_cercanas), 1 a 0 km y 0 a 30 km o más.
 *
 * Arranque en frío:
 *   - Usuario nuevo (sin historial): usa popularidad + cercanía + diversidad de categorías.
 *   - Producto nuevo (sin ventas): igual puede recomendarse por su contenido (TF-IDF no necesita ventas).
 *
 * Imparcialidad (Recomendación de la UNESCO sobre la ética de la IA, 2021): como máximo `maxPerShop`
 * productos de un mismo comercio en la lista, y cada sugerencia trae su `motivo` (explicable).
 *
 * Este archivo NO importa 'server-only' a propósito: es lógica pura (sin secretos) y así el script
 * `scripts/ia/evaluar-recomendaciones.ts` puede medir su precisión con Node sin levantar la app.
 * Solo lo usa el backend (src/backend/api/recommendations.ts).
 */

// ---------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------

export type EngineProduct = {
  id: string;
  tienda_id: string;
  /** Texto descriptivo: título, descripción y nombre de la categoría. */
  texto: string;
  categoria: string | null;
};

export type UserSignals = {
  favoriteIds: string[];
  purchasedIds: string[];
  /** Productos que el usuario está viendo o tiene en el carrito. */
  contextIds: string[];
  searchTerms: string[];
  categoryNames: string[];
  favoriteShopIds: string[];
};

export type EngineData = {
  products: EngineProduct[];
  /** Cestas anónimas: productos de un mismo pedido o favoritos de un mismo usuario. */
  baskets: string[][];
  /** Unidades vendidas por producto. */
  popularity: Map<string, number>;
  /** Distancia (km) del usuario a cada comercio, calculada por PostGIS. Vacío si no hay ubicación. */
  shopDistanceKm: Map<string, number>;
};

export type Components = { contenido: number; colaborativo: number; popularidad: number; cercania: number };

export type ScoredProduct = {
  id: string;
  tienda_id: string;
  score: number;
  componentes: Components;
  motivo: string;
};

export type ScoredShop = {
  tienda_id: string;
  score: number;
  motivo: string;
  productos_relevantes: number;
};

export type Weights = Components;

/** Pesos del modelo híbrido cuando el usuario tiene historial. */
export const DEFAULT_WEIGHTS: Weights = { contenido: 0.45, colaborativo: 0.3, popularidad: 0.15, cercania: 0.1 };
/** Pesos para usuarios nuevos (arranque en frío). */
export const COLD_START_WEIGHTS: Weights = { contenido: 0, colaborativo: 0, popularidad: 0.6, cercania: 0.4 };

const PROXIMITY_MAX_KM = 30;

// ---------------------------------------------------------------------------------------------
// Texto: tokenización y TF-IDF
// ---------------------------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'que', 'sin', 'su',
  'un', 'una', 'y', 'o', 'e', 'es', 'se', 'lo', 'mas', 'muy', 'tu', 'producto', 'productos',
]);

/** Minúsculas, sin tildes, sin palabras vacías; une plural/singular simple ("pizzas" -> "pizza"). */
export function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
    .map((term) => (term.length > 4 && term.endsWith('s') ? term.slice(0, -1) : term));
}

type Vector = Map<string, number>;

function cosine(left: Vector, right: Vector): number {
  if (left.size === 0 || right.size === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  left.forEach((value, term) => {
    leftNorm += value * value;
    const other = right.get(term);
    if (other) dot += value * other;
  });
  right.forEach((value) => { rightNorm += value * value; });
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

// ---------------------------------------------------------------------------------------------
// Modelo: vectores TF-IDF y matriz de co-ocurrencia (se calcula una vez por petición)
// ---------------------------------------------------------------------------------------------

export type Model = {
  products: EngineProduct[];
  byId: Map<string, EngineProduct>;
  vectors: Map<string, Vector>;
  toVector: (terms: string[]) => Vector;
  /** co[i][j] = cestas donde aparecen i y j juntos. */
  co: Map<string, Map<string, number>>;
  /** n[i] = cestas donde aparece i. */
  n: Map<string, number>;
  maxPopularity: number;
  data: EngineData;
};

export function buildModel(data: EngineData): Model {
  const documents = data.products.map((product) => tokenize(product.texto));
  const documentFrequency = new Map<string, number>();
  documents.forEach((terms) => new Set(terms).forEach((term) => documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1)));
  const total = data.products.length;

  const toVector = (terms: string[]): Vector => {
    const tf = new Map<string, number>();
    terms.forEach((term) => tf.set(term, (tf.get(term) || 0) + 1));
    const vector: Vector = new Map();
    tf.forEach((count, term) => {
      const idf = Math.log((total + 1) / ((documentFrequency.get(term) || 0) + 1)) + 1;
      vector.set(term, (count / (terms.length || 1)) * idf);
    });
    return vector;
  };

  const vectors = new Map<string, Vector>();
  data.products.forEach((product, index) => vectors.set(product.id, toVector(documents[index])));

  const known = new Set(data.products.map((product) => product.id));
  const co = new Map<string, Map<string, number>>();
  const n = new Map<string, number>();
  for (const basket of data.baskets) {
    const items = [...new Set(basket)].filter((id) => known.has(id));
    for (const item of items) n.set(item, (n.get(item) || 0) + 1);
    for (let a = 0; a < items.length; a += 1) {
      for (let b = a + 1; b < items.length; b += 1) {
        const [i, j] = [items[a], items[b]];
        if (!co.has(i)) co.set(i, new Map());
        if (!co.has(j)) co.set(j, new Map());
        co.get(i)!.set(j, (co.get(i)!.get(j) || 0) + 1);
        co.get(j)!.set(i, (co.get(j)!.get(i) || 0) + 1);
      }
    }
  }

  return {
    products: data.products,
    byId: new Map(data.products.map((product) => [product.id, product])),
    vectors,
    toVector,
    co,
    n,
    maxPopularity: Math.max(0, ...data.popularity.values()),
    data,
  };
}

/** Similitud colaborativa ítem-ítem (coseno sobre co-ocurrencias). */
export function itemSimilarity(model: Model, i: string, j: string): number {
  const together = model.co.get(i)?.get(j) || 0;
  if (!together) return 0;
  return together / Math.sqrt((model.n.get(i) || 1) * (model.n.get(j) || 1));
}

function proximity(model: Model, shopId: string): number {
  const km = model.data.shopDistanceKm.get(shopId);
  if (km === undefined || !Number.isFinite(km)) return 0;
  return Math.max(0, 1 - km / PROXIMITY_MAX_KM);
}

function hasHistory(signals: UserSignals) {
  return signals.favoriteIds.length + signals.purchasedIds.length + signals.contextIds.length
    + signals.searchTerms.length + signals.categoryNames.length > 0;
}

// ---------------------------------------------------------------------------------------------
// Recomendación de productos
// ---------------------------------------------------------------------------------------------

export type RecommendOptions = {
  limit?: number;
  maxPerShop?: number;
  weights?: Weights;
  /** Solo para la evaluación: usar una única señal ('contenido' | 'colaborativo' | 'popularidad'). */
  only?: keyof Components;
  exclude?: Set<string>;
};

export function recommendProducts(model: Model, signals: UserSignals, options: RecommendOptions = {}): ScoredProduct[] {
  const limit = options.limit ?? 8;
  const maxPerShop = options.maxPerShop ?? 2;
  const coldStart = !hasHistory(signals);
  const weights = options.weights ?? (coldStart ? COLD_START_WEIGHTS : DEFAULT_WEIGHTS);

  const seedIds = [...new Set([...signals.favoriteIds, ...signals.purchasedIds, ...signals.contextIds])]
    .filter((id) => model.byId.has(id));
  const seedVectors = seedIds.map((id) => model.vectors.get(id)!).filter(Boolean);
  const searchVector = model.toVector(signals.searchTerms.flatMap(tokenize));
  const categories = new Set(signals.categoryNames.map((name) => name.toLocaleLowerCase('es')));
  const exclude = options.exclude ?? new Set<string>([...signals.favoriteIds, ...signals.purchasedIds, ...signals.contextIds]);

  const scored = model.products
    .filter((product) => !exclude.has(product.id))
    .map((product): ScoredProduct => {
      const vector = model.vectors.get(product.id)!;
      // Contenido: mejor parecido con lo que le interesa + búsquedas + categorías buscadas
      const seedContent = seedVectors.length ? Math.max(...seedVectors.map((seed) => cosine(seed, vector))) : 0;
      const searchContent = searchVector.size ? cosine(searchVector, vector) : 0;
      const categoryMatch = product.categoria && categories.has(product.categoria.toLocaleLowerCase('es')) ? 1 : 0;
      const contenido = Math.min(1, Math.max(seedContent, searchContent) * 0.85 + categoryMatch * 0.15);
      // Colaborativo: el producto más parecido (por compras conjuntas) a lo que ya le interesa
      const colaborativo = seedIds.length ? Math.max(0, ...seedIds.map((id) => itemSimilarity(model, id, product.id))) : 0;
      const popularidad = model.maxPopularity > 0 ? (model.data.popularity.get(product.id) || 0) / model.maxPopularity : 0;
      const cercania = proximity(model, product.tienda_id);
      const componentes = { contenido, colaborativo, popularidad, cercania };

      let score: number;
      if (options.only) {
        score = componentes[options.only];
      } else {
        // Solo cuentan las señales disponibles (sin cestas no hay colaborativo; sin ubicación no hay cercanía)
        const available = (Object.keys(weights) as Array<keyof Components>).filter((key) => {
          if (key === 'colaborativo') return model.co.size > 0 && seedIds.length > 0;
          if (key === 'cercania') return model.data.shopDistanceKm.size > 0;
          if (key === 'popularidad') return model.maxPopularity > 0;
          if (key === 'contenido') return !coldStart;
          return true;
        });
        const totalWeight = available.reduce((sum, key) => sum + weights[key], 0) || 1;
        score = available.reduce((sum, key) => sum + weights[key] * componentes[key], 0) / totalWeight;
      }

      return { id: product.id, tienda_id: product.tienda_id, score, componentes, motivo: explain(model, componentes, seedIds, product, coldStart) };
    })
    .filter((item) => options.only ? item.score > 0 : true)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  return diversify(scored, limit, maxPerShop, coldStart ? model : null);
}

/** Máximo `maxPerShop` por comercio; en arranque en frío, además, una categoría distinta por vuelta. */
function diversify(sorted: ScoredProduct[], limit: number, maxPerShop: number, coldModel: Model | null): ScoredProduct[] {
  const result: ScoredProduct[] = [];
  const perShop = new Map<string, number>();
  const usedCategories = new Set<string>();
  const pending = [...sorted];

  const take = (requireNewCategory: boolean) => {
    for (let index = 0; index < pending.length && result.length < limit; index += 1) {
      const item = pending[index];
      if ((perShop.get(item.tienda_id) || 0) >= maxPerShop) continue;
      const category = coldModel?.byId.get(item.id)?.categoria ?? '';
      if (requireNewCategory && usedCategories.has(category)) continue;
      result.push(item);
      perShop.set(item.tienda_id, (perShop.get(item.tienda_id) || 0) + 1);
      usedCategories.add(category);
      pending.splice(index, 1);
      index -= 1;
    }
  };

  if (coldModel) take(true);
  take(false);
  return result;
}

function explain(model: Model, c: Components, seedIds: string[], product: EngineProduct, coldStart: boolean): string {
  if (coldStart) return c.cercania >= 0.5 ? 'Cerca de tu ubicación' : c.popularidad > 0 ? 'Popular en Guairá' : 'Novedad del catálogo';
  const strongest = (Object.entries(c) as Array<[keyof Components, number]>).sort((a, b) => b[1] - a[1])[0];
  if (strongest[0] === 'colaborativo' && strongest[1] > 0) {
    const anchor = seedIds.map((id) => [id, itemSimilarity(model, id, product.id)] as const).sort((a, b) => b[1] - a[1])[0];
    const name = anchor ? model.byId.get(anchor[0])?.texto.split(' · ')[0] : null;
    return name ? `Otros clientes que eligieron "${name}" también llevaron esto` : 'Otros clientes también lo llevaron';
  }
  if (strongest[0] === 'contenido' && strongest[1] > 0) return 'Parecido a lo que te interesa';
  if (strongest[0] === 'cercania' && strongest[1] > 0) return 'Cerca de tu ubicación';
  return 'Popular en Guairá';
}

// ---------------------------------------------------------------------------------------------
// Productos complementarios ("los clientes también llevaron")
// ---------------------------------------------------------------------------------------------

/**
 * Productos que suelen comprarse JUNTO con los indicados (filtrado colaborativo sobre las cestas).
 * Prioriza otras categorías (complemento, no sustituto). Si no hay compras conjuntas, recurre a contenido.
 */
export function complementaryProducts(model: Model, productIds: string[], limit = 4): ScoredProduct[] {
  const seeds = productIds.filter((id) => model.byId.has(id));
  if (seeds.length === 0) return [];
  const seedCategories = new Set(seeds.map((id) => model.byId.get(id)!.categoria));
  const exclude = new Set(seeds);

  const collaborative = model.products
    .filter((product) => !exclude.has(product.id))
    .map((product) => {
      const colaborativo = Math.max(0, ...seeds.map((id) => itemSimilarity(model, id, product.id)));
      const otherCategory = seedCategories.has(product.categoria) ? 0.85 : 1;
      return {
        id: product.id,
        tienda_id: product.tienda_id,
        score: colaborativo * otherCategory,
        componentes: { contenido: 0, colaborativo, popularidad: 0, cercania: proximity(model, product.tienda_id) },
        motivo: 'Los clientes suelen llevarlo junto',
      } satisfies ScoredProduct;
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (collaborative.length >= limit) return collaborative.slice(0, limit);
  // Complemento por contenido cuando todavía hay pocas compras conjuntas (arranque en frío del ítem)
  const byContent = recommendProducts(model, {
    favoriteIds: [], purchasedIds: [], contextIds: seeds, searchTerms: [], categoryNames: [], favoriteShopIds: [],
  }, { limit: limit * 2, weights: { contenido: 0.7, colaborativo: 0, popularidad: 0.2, cercania: 0.1 } })
    .filter((item) => !collaborative.some((existing) => existing.id === item.id))
    .map((item) => ({ ...item, motivo: 'Relacionado con lo que llevás' }));
  return [...collaborative, ...byContent].slice(0, limit);
}

// ---------------------------------------------------------------------------------------------
// Recomendación de comercios
// ---------------------------------------------------------------------------------------------

/**
 * Comercios relevantes: suma la afinidad de sus productos con el usuario, su cercanía (PostGIS)
 * y si es de un rubro parecido a los comercios que el usuario marcó como favoritos.
 */
export function recommendShops(
  model: Model,
  signals: UserSignals,
  shopCategories: Map<string, string | null>,
  limit = 4,
): ScoredShop[] {
  const productScores = recommendProducts(model, signals, { limit: model.products.length, maxPerShop: Number.MAX_SAFE_INTEGER, exclude: new Set() });
  const favoriteShopCategories = new Set(signals.favoriteShopIds.map((id) => shopCategories.get(id)).filter(Boolean));
  const shops = new Map<string, { best: number; relevant: number }>();
  for (const item of productScores) {
    const entry = shops.get(item.tienda_id) ?? { best: 0, relevant: 0 };
    entry.best = Math.max(entry.best, item.score);
    if (item.score > 0.1) entry.relevant += 1;
    shops.set(item.tienda_id, entry);
  }

  return [...shopCategories.keys()]
    .filter((shopId) => !signals.favoriteShopIds.includes(shopId))
    .map((shopId) => {
      const affinity = shops.get(shopId)?.best ?? 0;
      const near = proximity(model, shopId);
      const sameKind = favoriteShopCategories.has(shopCategories.get(shopId)) ? 1 : 0;
      const score = affinity * 0.6 + near * 0.25 + sameKind * 0.15;
      const motivo = sameKind ? 'Del mismo rubro que tus comercios favoritos'
        : affinity >= near ? 'Vende productos parecidos a lo que te interesa'
          : 'Cerca de tu ubicación';
      return { tienda_id: shopId, score, motivo, productos_relevantes: shops.get(shopId)?.relevant ?? 0 };
    })
    .filter((shop) => shop.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
