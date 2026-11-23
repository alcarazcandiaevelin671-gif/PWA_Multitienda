/**
 * [COMPARTIDO] Tipos del catálogo público (productos y distritos).
 *
 * Los usan el backend (backend/catalog/products.ts los devuelve) y el frontend
 * (directorio de productos, buscador). Solo tipos: no contiene lógica.
 */

/** Producto tal como se lee de la tabla `productos` (columnas reales de la base). */
export interface Product {
  id?: string;
  tienda_id: string;
  titulo: string;
  descripcion?: string;
  precio_gs: number;
  imagen_url?: string;
  categoria_id?: number;
  disponible?: boolean;
  creado_en?: string;
  /** Unidades disponibles; `null` = sin control de stock. */
  stock?: number | null;
  stock_minimo?: number | null;
}

/** Producto del catálogo público, con su precio de oferta y los datos de su tienda. */
export interface FeaturedProduct extends Product {
  precio_oferta?: number | null;
  tienda?: {
    nombre_comercio: string | null;
    slug: string | null;
    latitud?: number | null;
    longitud?: number | null;
    distrito_id?: number | null;
  } | null;
}

/** Distrito activo, usado para filtrar el catálogo por ubicación. */
export interface ProductDistrict {
  id: number;
  nombre: string;
}
