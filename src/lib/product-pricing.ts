import type { Product } from '@/types/product';

export function getEffectiveProductPrice(product: Product): number {
  const basePrice = Number(product.precio_gs ?? product.precio);
  const offerPrice = Number(product.precio_oferta);

  if (
    Number.isFinite(offerPrice)
    && offerPrice > 0
    && Number.isFinite(basePrice)
    && offerPrice < basePrice
  ) {
    return offerPrice;
  }

  return Number.isFinite(basePrice) ? basePrice : 0;
}