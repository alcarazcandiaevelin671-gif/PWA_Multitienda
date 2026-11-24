/**
 * [FRONTEND] Confirmación de un carrito MULTITIENDA: un pedido por comercio.
 *
 * Por cada grupo del carrito (CartShopGroup) se llama a /api/checkout, que registra el pedido,
 * la venta, la factura interna y descuenta stock en una transacción del lado de la base.
 * Después, el cliente envía a CADA comercio su propio mensaje estructurado de WhatsApp
 * (página /pedidos/enviar). Si se corta la conexión, los pedidos que faltan quedan en la cola
 * offline y se envían solos al reconectar.
 */
import type { CartShopGroup } from '@/shared/types/cart';
import type { CheckoutInput } from '@/shared/types/database';
import { getEffectiveProductPrice } from '@/shared/lib/product-pricing';
import { createOrder } from '@/frontend/services/orders.service';
import { isNetworkError, queueOrder } from '@/frontend/lib/offline-orders';

/** Datos comunes a todos los pedidos (los completa el cliente una sola vez). */
export type SharedOrderData = Omit<CheckoutInput, 'tienda_id' | 'items'>;

export type MultiStoreResult = {
  /** Pedidos registrados en el servidor. */
  created: Array<{ id: string; numero_pedido: string; tienda: string }>;
  /** Comercios cuyos pedidos quedaron guardados sin conexión. */
  queuedOffline: string[];
  /** Comercios cuyo pedido falló por otro motivo (stock, tienda inactiva…). */
  failed: Array<{ tienda: string; error: string }>;
  /** Tiendas cuyo pedido ya se registró o quedó en cola: sus productos se quitan del carrito. */
  doneShopIds: string[];
};

export async function submitOrdersByShop(
  groups: CartShopGroup[],
  shared: SharedOrderData,
  origen: 'checkout' | 'whatsapp',
): Promise<MultiStoreResult> {
  const result: MultiStoreResult = { created: [], queuedOffline: [], failed: [], doneShopIds: [] };
  let offline = typeof navigator !== 'undefined' && !navigator.onLine;

  for (const group of groups) {
    const input: CheckoutInput = {
      ...shared,
      tienda_id: group.tienda_id,
      items: group.items.map(({ product, cantidad }) => ({ producto_id: product.id, cantidad })),
    };
    const queue = () => {
      queueOrder({
        origen,
        input,
        resumen: {
          tienda: group.tienda_nombre,
          total: group.subtotal,
          items: group.items.map(({ product, cantidad }) => ({
            nombre: product.nombre ?? product.titulo ?? 'Producto',
            cantidad,
            precio: getEffectiveProductPrice(product),
          })),
        },
      });
      result.queuedOffline.push(group.tienda_nombre);
      result.doneShopIds.push(group.tienda_id);
    };

    if (offline) {
      queue();
      continue;
    }

    try {
      const { pedido } = await createOrder(input);
      result.created.push({ id: pedido.id, numero_pedido: pedido.numero_pedido, tienda: group.tienda_nombre });
      result.doneShopIds.push(group.tienda_id);
    } catch (error) {
      if (isNetworkError(error)) {
        offline = true; // se cortó la conexión: este y los siguientes van a la cola
        queue();
      } else {
        result.failed.push({ tienda: group.tienda_nombre, error: error instanceof Error ? error.message : 'No se pudo registrar el pedido.' });
      }
    }
  }

  return result;
}

/** Ruta a la que ir después de confirmar: el ticket (1 pedido) o el envío por comercio (varios). */
export function afterCheckoutPath(created: MultiStoreResult['created']): string | null {
  if (created.length === 0) return null;
  if (created.length === 1) return `/pedidos/${created[0].id}?origen=whatsapp#ticket`;
  return `/pedidos/enviar?ids=${created.map((order) => order.id).join(',')}`;
}
