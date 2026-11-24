/**
 * Evaluación OFFLINE del motor de recomendación (src/backend/recommendations/engine.ts).
 *
 * Uso:  node scripts/ia/evaluar-recomendaciones.mjs
 *       (Node 22.18+ ejecuta el motor .ts directamente. Para la parte "datos reales" lee
 *        SUPABASE_DB_URL de .env.local y usa psql; sin esa variable evalúa solo el conjunto simulado.)
 *
 * Protocolo (leave-one-out sobre productos NUEVOS para el cliente):
 *   Para cada usuario se oculta un producto de su ÚLTIMO pedido que NO haya comprado ni marcado como
 *   favorito antes. El modelo usa todo lo demás (pedidos anteriores y favoritos; se quita el último
 *   pedido completo del usuario) y genera su Top-5 excluyendo lo que el usuario ya conoce.
 *   Acierto = el producto oculto aparece en el Top-5. Los clientes cuyo último pedido no tiene ningún
 *   producto nuevo no se evalúan.
 *
 *   Por qué "nuevos": si el producto oculto ya está en el historial, el modelo de contenido lo compara
 *   consigo mismo (coseno = 1) y acierta sin recomendar nada (fuga de información).
 *
 * LIMITACIÓN: el conjunto simulado se genera con preferencias por rubro, complementos y cercanía, que son
 *   justamente las señales del modelo. Sirve para verificar que el motor las aprovecha y para comparar
 *   modelos entre sí; NO predice el desempeño con clientes reales.
 *
 * Métricas: HitRate@5 (= Recall@5, hay 1 relevante), Precision@5, NDCG@5, MRR@5, cobertura del catálogo.
 * Modelos comparados: Aleatorio, Popularidad, Contenido (TF-IDF), Colaborativo (ítem-ítem), Híbrido.
 *
 * Conjuntos:
 *   A) SIMULADO (reproducible, semilla fija): 30 comercios, 120 productos en 10 rubros del Guairá,
 *      400 clientes con preferencias por rubro, compras complementarias y cercanía. Sirve para
 *      validar el método cuando aún no hay volumen real. Se declara como simulado en la tesis.
 *   B) REAL (base de datos de prueba del prototipo): pocos pedidos; se informa con su tamaño.
 *
 * Resultado: docs/evaluacion/ia-resultados.json y docs/evaluacion/ia-resultados.md
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildModel,
  complementaryProducts,
  recommendProducts,
} from '../../src/backend/recommendations/engine.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const K = 5;

// ------------------------------------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------------------------------------

/** Generador pseudoaleatorio con semilla (mulberry32): mismos resultados en cada ejecución. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Mezcla uniforme (Fisher-Yates). */
function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const emptySignals = () => ({ favoriteIds: [], purchasedIds: [], contextIds: [], searchTerms: [], categoryNames: [], favoriteShopIds: [] });

function metricsFor(rankings) {
  // rankings: Array<{ list: string[], target: string }>
  let hits = 0; let ndcg = 0; let mrr = 0;
  const recommended = new Set();
  for (const { list, target } of rankings) {
    list.slice(0, K).forEach((id) => recommended.add(id));
    const position = list.slice(0, K).indexOf(target);
    if (position >= 0) {
      hits += 1;
      ndcg += 1 / Math.log2(position + 2); // IDCG = 1 (un solo relevante)
      mrr += 1 / (position + 1);
    }
  }
  const n = rankings.length || 1;
  const z = 1.96;
  const ph = hits / n;
  const centro = (ph + z * z / (2 * n)) / (1 + z * z / n);
  const margen = (z / (1 + z * z / n)) * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n));
  return {
    casos: rankings.length,
    aciertos: hits,
    ic95: rankings.length ? [Math.max(0, centro - margen), Math.min(1, centro + margen)] : null,
    hitRate: hits / n,
    precision: hits / (n * K),
    recall: hits / n,
    ndcg: ndcg / n,
    mrr: mrr / n,
    recomendadosDistintos: recommended.size,
  };
}

// ------------------------------------------------------------------------------------------
// A) Conjunto simulado
// ------------------------------------------------------------------------------------------

const RUBROS = {
  'Gastronomía': {
    productos: ['Pizza de muzzarella', 'Pizza napolitana', 'Hamburguesa completa', 'Empanadas de carne', 'Lomito árabe', 'Chipa guazú', 'Sopa paraguaya', 'Milanesa con papas', 'Asadito con mandioca', 'Pastel mandi\'o', 'Pollo asado', 'Tallarín con tuco'],
    palabras: 'comida casera caliente delivery almuerzo cena porción horno sabor',
  },
  'Bebidas': {
    productos: ['Gaseosa cola 2 litros', 'Jugo natural de naranja', 'Agua mineral 1,5 litros', 'Cerveza artesanal', 'Tereré preparado', 'Mosto helado', 'Gaseosa naranja 2 litros', 'Yerba mate con hierbas', 'Licuado de frutilla', 'Café de filtro', 'Agua tónica', 'Energizante'],
    palabras: 'bebida fría refrescante botella vaso helada sed',
  },
  'Panadería': {
    productos: ['Pan casero', 'Chipa almidón', 'Chipa so\'o', 'Torta de chocolate', 'Medialunas', 'Bizcochuelo', 'Pan dulce', 'Galletitas de manteca', 'Sándwich de miga', 'Alfajores de maicena', 'Torta de cumpleaños', 'Budín de banana'],
    palabras: 'horneado fresco dulce harina manteca mañana merienda',
  },
  'Artesanía': {
    productos: ['Ñandutí bordado', 'Hamaca paraguaya', 'Poncho para\'i', 'Canasta de karanday', 'Cerámica de Itá', 'Ao po\'i camisa', 'Atrapasueños tejido', 'Amigurumi tejido', 'Mate de palo santo', 'Bombilla de alpaca', 'Guampa de cuero', 'Tapiz de lana'],
    palabras: 'hecho a mano artesanal tradicional regalo tejido guairá cultura',
  },
  'Ferretería': {
    productos: ['Taladro percutor', 'Juego de brocas', 'Motosierra', 'Cadena para motosierra', 'Aceite de cadena', 'Escalera de aluminio', 'Martillo carpintero', 'Caja de clavos', 'Pintura látex 4 litros', 'Rodillo de pintura', 'Cinta métrica', 'Destornilladores'],
    palabras: 'herramienta construcción obra reparación metal resistente',
  },
  'Electrónica': {
    productos: ['Auriculares inalámbricos', 'Cargador rápido', 'Cable USB tipo C', 'Parlante bluetooth', 'Mouse inalámbrico', 'Teclado gamer', 'Monitor 24 pulgadas', 'Funda para celular', 'Vidrio templado', 'Power bank', 'Memoria USB 64 GB', 'Smartwatch'],
    palabras: 'tecnología digital batería conexión celular computadora',
  },
  'Ropa': {
    productos: ['Remera de algodón', 'Pantalón jean', 'Campera abrigada', 'Zapatillas deportivas', 'Medias pack', 'Gorra bordada', 'Vestido de verano', 'Camisa formal', 'Short deportivo', 'Buzo con capucha', 'Cinturón de cuero', 'Sandalias'],
    palabras: 'moda prenda talle algodón vestir temporada',
  },
  'Supermercado': {
    productos: ['Arroz 1 kg', 'Fideos tallarín', 'Aceite de girasol', 'Azúcar 1 kg', 'Leche entera', 'Yerba mate 1 kg', 'Harina 000', 'Huevos docena', 'Tomate en lata', 'Queso paraguay', 'Mandioca 2 kg', 'Galletas saladas'],
    palabras: 'almacén despensa consumo diario familia precio',
  },
  'Belleza': {
    productos: ['Shampoo', 'Acondicionador', 'Crema hidratante', 'Perfume floral', 'Esmalte de uñas', 'Protector solar', 'Jabón artesanal', 'Desodorante', 'Maquillaje base', 'Labial', 'Cepillo de pelo', 'Tintura para cabello'],
    palabras: 'cuidado personal piel cabello aroma cosmético',
  },
  'Mascotas': {
    productos: ['Alimento para perro 15 kg', 'Alimento para gato', 'Collar para perro', 'Correa', 'Juguete mordedor', 'Cama para mascota', 'Shampoo para perros', 'Arena para gatos', 'Comedero', 'Antipulgas', 'Snacks para perro', 'Transportadora'],
    palabras: 'mascota perro gato cuidado veterinaria',
  },
};

// Complementos entre rubros (lo que suele llevarse junto)
const COMPLEMENTOS = {
  'Gastronomía': ['Bebidas'], 'Panadería': ['Bebidas'], 'Bebidas': ['Gastronomía'],
  'Ferretería': ['Ferretería'], 'Electrónica': ['Electrónica'], 'Ropa': ['Ropa'],
  'Supermercado': ['Supermercado'], 'Artesanía': ['Artesanía'], 'Belleza': ['Belleza'], 'Mascotas': ['Mascotas'],
};
// Pares explícitos dentro del mismo rubro (producto -> complemento natural)
const PARES = [
  ['Motosierra', 'Cadena para motosierra'], ['Motosierra', 'Aceite de cadena'], ['Taladro percutor', 'Juego de brocas'],
  ['Pintura látex 4 litros', 'Rodillo de pintura'], ['Martillo carpintero', 'Caja de clavos'],
  ['Mate de palo santo', 'Bombilla de alpaca'], ['Guampa de cuero', 'Bombilla de alpaca'],
  ['Funda para celular', 'Vidrio templado'], ['Cargador rápido', 'Cable USB tipo C'], ['Teclado gamer', 'Mouse inalámbrico'],
  ['Shampoo', 'Acondicionador'], ['Alimento para perro 15 kg', 'Snacks para perro'], ['Alimento para gato', 'Arena para gatos'],
  ['Arroz 1 kg', 'Aceite de girasol'], ['Fideos tallarín', 'Tomate en lata'], ['Pantalón jean', 'Cinturón de cuero'],
];

function buildSyntheticDataset(seed = 2026) {
  const random = rng(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const rubros = Object.keys(RUBROS);

  // 30 comercios repartidos en el Guairá (aprox. lat -25.6/-26.0, lng -56.1/-56.6)
  const shops = Array.from({ length: 30 }, (_, index) => ({
    id: `tienda-${index + 1}`,
    rubro: rubros[index % rubros.length],
    lat: -25.6 - random() * 0.4,
    lng: -56.1 - random() * 0.5,
  }));

  // 120 productos: cada producto en un comercio de su rubro
  const products = [];
  for (const rubro of rubros) {
    const shopsOfRubro = shops.filter((shop) => shop.rubro === rubro);
    RUBROS[rubro].productos.forEach((nombre, index) => {
      const shop = shopsOfRubro[index % shopsOfRubro.length];
      products.push({
        id: `p-${products.length + 1}`,
        tienda_id: shop.id,
        nombre,
        rubro,
        texto: `${nombre} · ${nombre.toLowerCase()} ${RUBROS[rubro].palabras} · ${rubro}`,
        categoria: rubro,
        // popularidad "intrínseca" (Zipf dentro del rubro)
        peso: 1 / (index + 1) ** 0.8,
      });
    });
  }
  const byName = new Map(products.map((product) => [product.nombre, product]));
  const pairOf = new Map();
  for (const [a, b] of PARES) {
    if (!pairOf.has(a)) pairOf.set(a, []);
    pairOf.get(a).push(b);
  }

  const weightedPick = (list, weightOf) => {
    const total = list.reduce((sum, item) => sum + weightOf(item), 0);
    let r = random() * total;
    for (const item of list) { r -= weightOf(item); if (r <= 0) return item; }
    return list[list.length - 1];
  };

  // 400 clientes con 1-2 rubros preferidos y una ubicación
  const users = Array.from({ length: 400 }, (_, index) => {
    const prefs = [pick(rubros)];
    if (random() < 0.6) prefs.push(pick(rubros));
    return { id: `u-${index + 1}`, prefs, lat: -25.6 - random() * 0.4, lng: -56.1 - random() * 0.5, orders: [], favorites: [] };
  });

  for (const user of users) {
    const nearWeight = (product) => {
      const shop = shops.find((s) => s.id === product.tienda_id);
      const km = haversineKm(user.lat, user.lng, shop.lat, shop.lng);
      return product.peso * (1 / (1 + km / 8)); // prefiere comercios cercanos
    };
    const ordersCount = 3 + Math.floor(random() * 5);
    for (let o = 0; o < ordersCount; o += 1) {
      const rubro = random() < 0.85 ? pick(user.prefs) : pick(rubros);
      const main = weightedPick(products.filter((p) => p.rubro === rubro), nearWeight);
      const basket = [main.id];
      // Complemento explícito
      const pairs = pairOf.get(main.nombre);
      if (pairs && random() < 0.6) basket.push(byName.get(pick(pairs)).id);
      // Complemento entre rubros (comida + bebida, etc.)
      if (random() < 0.45) {
        const compRubro = pick(COMPLEMENTOS[rubro]);
        const comp = weightedPick(products.filter((p) => p.rubro === compRubro && !basket.includes(p.id)), nearWeight);
        basket.push(comp.id);
      }
      if (random() < 0.15) basket.push(pick(products).id); // ruido
      user.orders.push([...new Set(basket)]);
    }
    const favCount = Math.floor(random() * 3);
    for (let f = 0; f < favCount; f += 1) {
      user.favorites.push(weightedPick(products.filter((p) => user.prefs.includes(p.rubro)), nearWeight).id);
    }
  }

  return { shops, products, users };
}

function evaluateDataset({ shops, products, users }, { withLocation }) {
  const engineProducts = products.map(({ id, tienda_id, texto, categoria }) => ({ id, tienda_id, texto, categoria }));
  const models = ['Aleatorio', 'Popularidad', 'Contenido (TF-IDF)', 'Colaborativo (ítem-ítem)', 'Híbrido'];
  const rankings = Object.fromEntries(models.map((name) => [name, []]));
  const complementRankings = { 'Aleatorio': [], 'Popularidad': [], 'Complementarios (motor)': [] };
  const coldRankings = { 'Aleatorio': [], 'Popularidad': [], 'Motor en frío (popularidad + cercanía)': [] };
  const random = rng(7);

  /** Datos de entrenamiento: todas las cestas salvo los pedidos del usuario que `skip` descarta. */
  const training = (user, keepOwn) => {
    const baskets = [];
    const popularity = new Map();
    for (const other of users) {
      const orders = other === user ? keepOwn(other.orders) : other.orders;
      for (const order of orders) {
        baskets.push(order);
        order.forEach((id) => popularity.set(id, (popularity.get(id) || 0) + 1));
      }
      if (other.favorites.length && (other !== user || keepOwn(other.orders).length)) baskets.push(other.favorites);
    }
    return { baskets, popularity };
  };
  let sinProductoNuevo = 0;

  for (const user of users) {
    if (user.orders.length < 2) continue;
    const lastOrder = user.orders[user.orders.length - 1];
    const history = [...new Set(user.orders.slice(0, -1).flat())];
    const known = new Set([...history, ...user.favorites]);
    const novel = lastOrder.filter((id) => !known.has(id));

    const shopDistanceKm = new Map();
    if (withLocation && user.lat != null) {
      for (const shop of shops) shopDistanceKm.set(shop.id, haversineKm(user.lat, user.lng, shop.lat, shop.lng));
    }
    const model = buildModel({ products: engineProducts, ...training(user, (orders) => orders.slice(0, -1)), shopDistanceKm });

    // 1) Recomendación personalizada: solo productos nuevos para el cliente
    if (novel.length) {
      const target = novel[Math.floor(random() * novel.length)];
      const signals = { ...emptySignals(), purchasedIds: history, favoriteIds: [...new Set(user.favorites)] };
      const top = (options) => recommendProducts(model, signals, { limit: K, exclude: known, ...options }).map((item) => item.id);
      const candidates = products.map((product) => product.id).filter((id) => !known.has(id));
      rankings['Aleatorio'].push({ list: shuffle(candidates, random).slice(0, K), target });
      rankings['Popularidad'].push({ list: top({ only: 'popularidad' }), target });
      rankings['Contenido (TF-IDF)'].push({ list: top({ only: 'contenido' }), target });
      rankings['Colaborativo (ítem-ítem)'].push({ list: top({ only: 'colaborativo' }), target });
      rankings['Híbrido'].push({ list: top({}), target });
    } else {
      sinProductoNuevo += 1;
    }

    // 2) Complementarios: con el primer producto del último pedido en el carrito, ¿sugiere OTRO (elegido al azar) del mismo pedido?
    if (lastOrder.length >= 2) {
      const [anchor, ...rest] = lastOrder;
      const target = rest[Math.floor(random() * rest.length)];
      const candidates = products.map((product) => product.id).filter((id) => id !== anchor);
      complementRankings['Aleatorio'].push({ list: shuffle(candidates, random).slice(0, K), target });
      complementRankings['Popularidad'].push({ list: recommendProducts(model, emptySignals(), { limit: K, only: 'popularidad', exclude: new Set([anchor]) }).map((item) => item.id), target });
      complementRankings['Complementarios (motor)'].push({ list: complementaryProducts(model, [anchor], K).map((item) => item.id), target });
    }

    // 3) Arranque en frío: cliente sin historial; objetivo = primer producto de su primer pedido.
    //    Se quitan TODOS sus pedidos y favoritos del entrenamiento.
    const coldModel = buildModel({ products: engineProducts, ...training(user, () => []), shopDistanceKm });
    const firstTarget = user.orders[0][0];
    coldRankings['Aleatorio'].push({ list: shuffle(products.map((p) => p.id), random).slice(0, K), target: firstTarget });
    coldRankings['Popularidad'].push({ list: recommendProducts(coldModel, emptySignals(), { limit: K, only: 'popularidad', exclude: new Set() }).map((item) => item.id), target: firstTarget });
    coldRankings['Motor en frío (popularidad + cercanía)'].push({ list: recommendProducts(coldModel, emptySignals(), { limit: K, exclude: new Set() }).map((item) => item.id), target: firstTarget });
  }

  const summarize = (group) => Object.fromEntries(Object.entries(group).map(([name, list]) => [name, metricsFor(list)]));
  return {
    principal: summarize(rankings),
    complementarios: summarize(complementRankings),
    arranqueEnFrio: summarize(coldRankings),
    catalogo: products.length,
    clientesSinProductoNuevo: sinProductoNuevo,
  };
}

// ------------------------------------------------------------------------------------------
// B) Datos reales del prototipo (base de prueba)
// ------------------------------------------------------------------------------------------

function loadEnv() {
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]));
}

/** Lee los datos reales con psql (SUPABASE_DB_URL de .env.local). Variable opcional: PSQL_PATH. */
async function loadRealDataset() {
  const env = loadEnv();
  const dbUrl = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
  if (!dbUrl) return null;
  const { execFileSync } = await import('node:child_process');
  const psql = process.env.PSQL_PATH || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin/psql.exe' : 'psql');
  const sql = `
    select json_build_object(
      'productos', (select coalesce(json_agg(json_build_object('id', p.id, 'tienda_id', p.tienda_id,
          'nombre', coalesce(nullif(btrim(p.nombre), ''), p.titulo), 'descripcion', p.descripcion,
          'categoria', c.nombre, 'rubro', t.categoria_principal)), '[]')
        from productos p join tiendas t on t.id = p.tienda_id left join categorias c on c.id = p.categoria_id
        where p.disponible and p.eliminado_en is null and t.estado = 'activa' and t.eliminado_en is null),
      'tiendas', (select coalesce(json_agg(json_build_object('id', id, 'lat', latitud, 'lng', longitud, 'rubro', categoria_principal)), '[]')
        from tiendas where estado = 'activa' and eliminado_en is null),
      'pedidos', (select coalesce(json_agg(json_build_object('usuario_id', pe.usuario_id, 'items',
          (select json_agg(distinct d.producto_id) from pedido_detalles d where d.pedido_id = pe.id and d.producto_id is not null))
          order by pe.created_at), '[]')
        from pedidos pe where pe.estado::text <> 'cancelado' and pe.eliminado_en is null),
      'favoritos', (select coalesce(json_agg(json_build_object('usuario_id', usuario_id, 'producto_id', producto_id)), '[]')
        from favoritos where producto_id is not null and eliminado_en is null)
    )`;
  const raw = execFileSync(psql, [dbUrl, '-X', '-A', '-t', '-c', sql], { encoding: 'utf8', env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
  const data = JSON.parse(raw.trim());

  const shops = data.tiendas.map((s) => ({ id: s.id, lat: Number(s.lat), lng: Number(s.lng), rubro: s.rubro }));
  const products = data.productos.map((p) => ({
    id: p.id,
    tienda_id: p.tienda_id,
    texto: [p.nombre, p.descripcion, p.categoria, p.rubro].filter(Boolean).join(' · '),
    categoria: p.categoria ?? null,
  }));
  const known = new Set(products.map((p) => p.id));
  const users = new Map();
  let multi = 0;
  for (const order of data.pedidos) {
    const items = [...new Set(order.items || [])].filter((id) => known.has(id));
    if ((order.items || []).length > 1) multi += 1;
    if (!items.length) continue;
    if (!users.has(order.usuario_id)) users.set(order.usuario_id, { id: order.usuario_id, orders: [], favorites: [], lat: null, lng: null });
    users.get(order.usuario_id).orders.push(items);
  }
  for (const favorite of data.favoritos) {
    if (users.has(favorite.usuario_id) && known.has(favorite.producto_id)) users.get(favorite.usuario_id).favorites.push(favorite.producto_id);
  }
  return {
    shops,
    products,
    users: [...users.values()],
    resumen: {
      productos: products.length,
      comercios: shops.length,
      clientesConPedidos: users.size,
      pedidos: data.pedidos.length,
      pedidosConVariosProductos: multi,
    },
  };
}

// ------------------------------------------------------------------------------------------

const pct = (value) => `${(value * 100).toFixed(1)} %`;

function tableMd(title, group) {
  const rows = Object.entries(group).map(([name, m]) =>
    `| ${name} | ${m.casos} | ${pct(m.hitRate)} (${m.ic95 ? `${pct(m.ic95[0])} a ${pct(m.ic95[1])}` : '—'}) | ${pct(m.precision)} | ${m.ndcg.toFixed(3)} | ${m.mrr.toFixed(3)} | ${m.recomendadosDistintos} |`);
  return [`### ${title}`, '', '| Modelo | Casos | HitRate@5 (IC 95 %) | Precision@5 | NDCG@5 | MRR@5 | Productos distintos recomendados |', '|---|---|---|---|---|---|---|', ...rows, ''].join('\n');
}

const started = Date.now();
const simulated = evaluateDataset(buildSyntheticDataset(2026), { withLocation: true });
const SEMILLAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const porSemilla = SEMILLAS.map((seed) => evaluateDataset(buildSyntheticDataset(seed), { withLocation: true }).principal);
const robustez = Object.fromEntries(Object.keys(simulated.principal).map((name) => {
  const values = porSemilla.map((r) => r[name].hitRate);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1));
  return [name, { media: mean, desvio: sd, minimo: Math.min(...values), maximo: Math.max(...values) }];
}));
let real = null;
let realError = null;
try {
  const dataset = await loadRealDataset();
  if (dataset) real = { resumen: dataset.resumen, ...evaluateDataset(dataset, { withLocation: false }) };
} catch (error) {
  realError = error.message;
}

const output = {
  fecha: new Date().toISOString(),
  protocolo: 'leave-one-out sobre un producto del último pedido NUEVO para el cliente, Top-5, excluyendo lo que ya compró o marcó como favorito',
  k: K,
  simulado: { descripcion: '30 comercios, 120 productos en 10 rubros, 400 clientes; semilla 2026', ...simulated, robustez: { semillas: SEMILLAS, hitRate: robustez } },
  real: real ?? { error: realError ?? 'Sin credenciales: no se evaluaron datos reales' },
  duracionMs: Date.now() - started,
};

const outDir = join(ROOT, 'docs', 'evaluacion');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'ia-resultados.json'), JSON.stringify(output, null, 2));

const md = [
  '# Evaluación offline del motor de recomendación',
  '',
  `Fecha: ${output.fecha.slice(0, 10)} · Protocolo: ${output.protocolo} · Script: \`node scripts/ia/evaluar-recomendaciones.mjs\``,
  '',
  '## A) Conjunto simulado (reproducible)',
  '',
  output.simulado.descripcion,
  '',
  tableMd('Recomendación personalizada', simulated.principal),
  tableMd('Productos complementarios (carrito con 1 producto → ¿sugiere otro del mismo pedido?)', simulated.complementarios),
  tableMd('Arranque en frío (cliente sin historial)', simulated.arranqueEnFrio),
  '### Robustez: HitRate@5 en 10 simulaciones distintas (semillas 1 a 10)',
  '',
  '| Modelo | Media | Desvío | Mínimo | Máximo |',
  '|---|---|---|---|---|',
  ...Object.entries(robustez).map(([name, r]) => `| ${name} | ${pct(r.media)} | ${pct(r.desvio)} | ${pct(r.minimo)} | ${pct(r.maximo)} |`),
  '',
  '> El conjunto simulado se genera con preferencias por rubro, complementos y cercanía, las mismas señales que usa el modelo: permite comparar modelos, no predice el desempeño con clientes reales.',
  '',
  '## B) Datos reales del prototipo (base de prueba)',
  '',
  real ? `Productos: ${real.resumen.productos} · Comercios activos: ${real.resumen.comercios} · Clientes con pedidos: ${real.resumen.clientesConPedidos} · Pedidos: ${real.resumen.pedidos} (con 2+ productos: ${real.resumen.pedidosConVariosProductos})` : `No evaluado: ${output.real.error}`,
  '',
  real ? tableMd('Recomendación personalizada (datos reales)', real.principal) : '',
  real ? '> Con tan pocos casos el resultado no es estadísticamente significativo; se informa por transparencia.' : '',
].join('\n');
writeFileSync(join(outDir, 'ia-resultados.md'), md);
console.log(md);
