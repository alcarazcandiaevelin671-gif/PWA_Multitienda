/**
 * [FRONTEND] Cola de pedidos sin conexión (localStorage): guardar, reintentar, descartar y enviar al reconectar.
 */
import type { CheckoutConfirmation, CheckoutInput } from '@/shared/types/database';

/** Pedido confirmado sin conexión, pendiente de enviarse al servidor. */
export type QueuedOrder = {
  localId: string;
  createdAt: string;
  origen: 'checkout' | 'whatsapp';
  input: CheckoutInput;
  resumen: {
    tienda: string;
    total: number;
    items: Array<{ nombre: string; cantidad: number; precio: number }>;
  };
  estado: 'pendiente' | 'error';
  error?: string;
};

const STORAGE_KEY = 'pwa_multitienda_offline_orders';
export const OFFLINE_ORDERS_EVENT = 'offline-orders-changed';

function emitChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_ORDERS_EVENT));
}

export function getQueuedOrders(): QueuedOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueuedOrders(orders: QueuedOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // almacenamiento lleno o bloqueado: no hay dónde guardar
  }
  emitChange();
}

export function queueOrder(order: Omit<QueuedOrder, 'localId' | 'createdAt' | 'estado'>): QueuedOrder {
  const queued: QueuedOrder = {
    ...order,
    localId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    estado: 'pendiente',
  };
  saveQueuedOrders([...getQueuedOrders(), queued]);
  return queued;
}

export function removeQueuedOrder(localId: string) {
  saveQueuedOrders(getQueuedOrders().filter((order) => order.localId !== localId));
}

/** Vuelve a dejar un pedido rechazado como pendiente para reintentarlo. */
export function retryQueuedOrder(localId: string) {
  saveQueuedOrders(getQueuedOrders().map((order) => (
    order.localId === localId ? { ...order, estado: 'pendiente', error: undefined } : order
  )));
}

/** true si el error es de red (sin internet), no un rechazo del servidor. */
export function isNetworkError(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (error instanceof TypeError) return true; // fetch() sin conexión
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|network|load failed|offline|conectar con el servidor/i.test(message);
}

export type FlushResult = {
  enviados: Array<{ queued: QueuedOrder; confirmacion: CheckoutConfirmation }>;
  rechazados: QueuedOrder[];
};

let flushing: Promise<FlushResult> | null = null;

/** Envía los pedidos pendientes. Los que fallan por red quedan en cola; los rechazados se marcan con error. */
export function flushQueuedOrders(
  send: (input: CheckoutInput) => Promise<CheckoutConfirmation>,
): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { enviados: [], rechazados: [] };
    for (const queued of getQueuedOrders().filter((order) => order.estado === 'pendiente')) {
      try {
        const confirmacion = await send(queued.input);
        removeQueuedOrder(queued.localId);
        result.enviados.push({ queued, confirmacion });
      } catch (error) {
        if (isNetworkError(error)) break; // seguimos sin conexión: reintentar después
        const message = error instanceof Error ? error.message : 'El servidor rechazó el pedido.';
        saveQueuedOrders(getQueuedOrders().map((order) => (
          order.localId === queued.localId ? { ...order, estado: 'error', error: message } : order
        )));
        result.rechazados.push({ ...queued, estado: 'error', error: message });
      }
    }
    return result;
  })().finally(() => { flushing = null; });
  return flushing;
}
