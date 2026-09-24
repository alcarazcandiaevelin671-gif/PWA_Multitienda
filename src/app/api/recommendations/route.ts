import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type CatalogProduct = {
  id: string;
  tienda_id: string;
  titulo?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  categoria_id?: string | number | null;
  precio_gs?: number | null;
  imagen_url?: string | null;
  disponible?: boolean | null;
};

type StoreLocation = {
  id: string;
  latitud?: number | null;
  longitud?: number | null;
};

type Recommendation = {
  id: string;
  nombre: string;
  precio: number;
  imagen_url: string | null;
  tienda_id: string;
  similarity_score: number;
};

const STOP_WORDS = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por',
  'que', 'sin', 'su', 'un', 'una', 'y', 'o', 'producto', 'productos',
]);

function tokenize(product: CatalogProduct): string[] {
  const text = [
    product.titulo,
    product.nombre,
    product.descripcion,
    product.categoria_id,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('es');

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function termFrequency(terms: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  terms.forEach((term) => frequencies.set(term, (frequencies.get(term) || 0) + 1));
  return frequencies;
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  const vocabulary = new Set([...left.keys(), ...right.keys()]);
  vocabulary.forEach((term) => {
    const leftValue = left.get(term) || 0;
    const rightValue = right.get(term) || 0;
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue ** 2;
    rightMagnitude += rightValue ** 2;
  });

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function distanceScore(
  store: StoreLocation | undefined,
  latitude?: number,
  longitude?: number,
): number {
  if (
    latitude === undefined ||
    longitude === undefined ||
    store?.latitud == null ||
    store.longitud == null
  ) {
    return 0;
  }

  const latitudeDistance = (store.latitud - latitude) * 111;
  const longitudeDistance = (store.longitud - longitude) * 111 * Math.cos((latitude * Math.PI) / 180);
  const distanceKm = Math.sqrt(latitudeDistance ** 2 + longitudeDistance ** 2);
  return Math.max(0, 1 - distanceKm / 50);
}

function parseLimit(value: string | null): number {
  const limit = Number(value || 6);
  return Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 20) : 6;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const productId = searchParams.get('productId');
  const userId = searchParams.get('userId');
  const latitudeValue = Number(searchParams.get('lat'));
  const longitudeValue = Number(searchParams.get('lng'));
  const latitude = Number.isFinite(latitudeValue) ? latitudeValue : undefined;
  const longitude = Number.isFinite(longitudeValue) ? longitudeValue : undefined;
  const limit = parseLimit(searchParams.get('limit'));

  try {
    let sourceProductId = productId;

    if (!sourceProductId && userId) {
      const { data: store, error: storeError } = await supabase
        .from('tiendas')
        .select('id')
        .eq('usuario_id', userId)
        .maybeSingle();

      if (storeError) throw storeError;

      if (store) {
        const { data: latestProduct, error: productError } = await supabase
          .from('productos')
          .select('id')
          .eq('tienda_id', store.id)
          .eq('disponible', true)
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (productError) throw productError;
        sourceProductId = latestProduct?.id;
      }
    }

    if (!sourceProductId) {
      return NextResponse.json(
        { error: 'Debes indicar productId o un userId con productos disponibles.' },
        { status: 400 },
      );
    }

    const { data: catalog, error: catalogError } = await supabase
      .from('productos')
      .select('id, tienda_id, titulo, nombre, descripcion, categoria_id, precio_gs, imagen_url, disponible')
      .eq('disponible', true);

    if (catalogError) throw catalogError;

    const products = (catalog || []) as CatalogProduct[];
    const sourceProduct = products.find((product) => product.id === sourceProductId);

    if (!sourceProduct) {
      return NextResponse.json({ error: 'Producto de referencia no encontrado.' }, { status: 404 });
    }

    const documents = products.map(tokenize);
    const documentFrequency = new Map<string, number>();
    documents.forEach((terms) => {
      new Set(terms).forEach((term) => documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1));
    });

    const totalDocuments = products.length;
    const toTfidf = (terms: string[]) => {
      const frequencies = termFrequency(terms);
      const totalTerms = terms.length || 1;
      const vector = new Map<string, number>();

      frequencies.forEach((frequency, term) => {
        const inverseDocumentFrequency = Math.log((totalDocuments + 1) / ((documentFrequency.get(term) || 0) + 1)) + 1;
        vector.set(term, (frequency / totalTerms) * inverseDocumentFrequency);
      });

      return vector;
    };

    const sourceVector = toTfidf(tokenize(sourceProduct));
    const storeIds = [...new Set(products.map((product) => product.tienda_id))];
    const { data: stores, error: storesError } = await supabase
      .from('tiendas')
      .select('id, latitud, longitud')
      .in('id', storeIds);

    if (storesError) throw storesError;

    const storesById = new Map((stores || []).map((store) => [store.id, store as StoreLocation]));
    const recommendations: Recommendation[] = products
      .filter((product) => product.id !== sourceProductId)
      .map((product, index) => {
        const textScore = cosineSimilarity(sourceVector, toTfidf(documents[index]));
        const locationScore = distanceScore(storesById.get(product.tienda_id), latitude, longitude);
        const similarityScore = Math.min(1, textScore * 0.85 + locationScore * 0.15);

        return {
          id: product.id,
          nombre: product.nombre || product.titulo || 'Producto',
          precio: Number(product.precio_gs || 0),
          imagen_url: product.imagen_url || null,
          tienda_id: product.tienda_id,
          similarity_score: Number(similarityScore.toFixed(4)),
        };
      })
      .sort((left, right) => right.similarity_score - left.similarity_score)
      .slice(0, limit);

    return NextResponse.json(recommendations);
  } catch (error: any) {
    console.error('Error generando recomendaciones:', error);
    return NextResponse.json(
      { error: error?.message || 'No se pudieron generar recomendaciones.' },
      { status: 500 },
    );
  }
}
