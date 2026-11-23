/**
 * [COMPARTIDO] Precio de un producto: oferta, precio anterior, descuento y stock.
 *
 * Una sola fuente de verdad para toda la app (vitrina, buscador, favoritos, carrito, checkout).
 * La base de datos valida lo mismo con la restricción `productos_precio_oferta_check`:
 * la oferta debe ser mayor a 0 y menor al precio normal.
 */
import type { Product } from '@/shared/types/product';

/** Resultado de calcular el precio que se muestra y se cobra. */
export interface ProductPricing {
  /** Precio que paga el cliente (la oferta si hay una válida). */
  price: number;
  /** Precio normal tachado; `null` si no hay oferta. */
  originalPrice: number | null;
  /** Porcentaje de descuento redondeado (ej: 20 para -20%); 0 si no hay oferta. */
  discountPercent: number;
}

/** Calcula el precio a partir del precio normal y la oferta opcional. */
export function getPricing(basePrice: unknown, offerPrice?: unknown): ProductPricing {
  const base = Number(basePrice);
  const offer = offerPrice == null || offerPrice === '' ? Number.NaN : Number(offerPrice);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 0;

  if (Number.isFinite(offer) && offer > 0 && offer < safeBase) {
    return {
      price: offer,
      originalPrice: safeBase,
      discountPercent: Math.round(((safeBase - offer) / safeBase) * 100),
    };
  }
  return { price: safeBase, originalPrice: null, discountPercent: 0 };
}

/** Precio efectivo de un producto del carrito (la oferta si es válida y menor al normal). */
export function getEffectiveProductPrice(product: Product): number {
  return getPricing(product.precio_gs ?? product.precio, product.precio_oferta).price;
}

/**
 * Stock que queda para mostrar "¡Últimas N unidades!".
 * Devuelve `null` si el producto no controla stock o si todavía hay bastante.
 */
export function getLowStock(stock: unknown, stockMinimo: unknown = 5): number | null {
  if (stock == null || stock === '') return null;
  const remaining = Number(stock);
  const minimum = Number(stockMinimo ?? 5);
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  return remaining <= (Number.isFinite(minimum) ? minimum : 5) ? remaining : null;
}

/** Máximo de unidades que se pueden pedir; `Infinity` si el producto no controla stock. */
export function getMaxQuantity(stock: unknown): number {
  if (stock == null || stock === '') return Number.POSITIVE_INFINITY;
  const value = Number(stock);
  return Number.isFinite(value) ? Math.max(0, value) : Number.POSITIVE_INFINITY;
}
