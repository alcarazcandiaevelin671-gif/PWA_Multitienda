/**
 * [COMPARTIDO] Tipos del carrito de compras.
 */
import { Product } from './product';

export interface CartItem {
  product: Product;
  cantidad: number;
}

/** Productos del carrito de un mismo comercio: se convierten en UN pedido y UN mensaje de WhatsApp. */
export interface CartShopGroup {
  tienda_id: string;
  tienda_nombre: string;
  tienda_slug: string | null;
  items: CartItem[];
  subtotal: number;
}