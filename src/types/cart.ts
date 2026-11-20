import { Product } from './product';

export interface CartItem {
  product: Product;
  cantidad: number;
}

export interface CartState {
  items: CartItem[];
  shopId: string | null; // Garantiza que no se mezclen productos de distintas tiendas en una misma orden
}