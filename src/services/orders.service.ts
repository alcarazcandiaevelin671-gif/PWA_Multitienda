import { supabase } from '@/lib/supabase';
import type { CheckoutConfirmation, CheckoutInput, Pedido, PedidoDetalle, PedidoEstadoHistorial } from '@/types/database';

export type PedidoConTienda = Pedido & {
  tienda: { nombre_comercio: string } | null;
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

export const ORDER_STATUS_FLOW: Record<string, string[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['en_preparacion', 'cancelado'],
  en_preparacion: ['listo', 'cancelado'],
  listo: ['completado'],
  completado: [],
  cancelado: [],
};

function getSupabaseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Error al consultar la base de datos.';
}

export function isPermissionError(error: unknown): boolean {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  return /row level security|permission denied|insufficient privilege|forbidden|403|401/.test(message);
}

export function isMissingTableError(error: unknown): boolean {
  const message = getSupabaseErrorMessage(error).toLowerCase();
  return /does not exist|relation .* does not exist|42p01|no existe/.test(message);
}

export function formatCurrency(value: number | string | null | undefined): string {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(numericValue);
}

export function getOrderStateLabel(state: string | null | undefined): string {
  return ORDER_STATUS_LABELS[state ?? ''] ?? state ?? 'Sin estado';
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Inicia sesión para consultar esta información.');
  }
  return user;
}

export async function createOrder(input: CheckoutInput) {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'No se pudo crear el pedido.');
  }

  return result as CheckoutConfirmation;
}

export async function getMyOrders(): Promise<PedidoConTienda[]> {
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('pedidos')
    .select('*, tienda:tiendas(nombre_comercio)')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (isPermissionError(error)) {
      throw new Error('No tienes permisos para consultar tus pedidos.');
    }
    if (isMissingTableError(error)) {
      throw new Error('La tabla pedidos no está disponible en Supabase.');
    }
    throw new Error(message || 'No se pudieron cargar tus pedidos.');
  }

  return (data || []) as unknown as PedidoConTienda[];
}

export async function getMyOrder(orderId: string) {
  const user = await getCurrentUser();

  const { data: pedido, error: orderError } = await supabase
    .from('pedidos')
    .select('*, tienda:tiendas(nombre_comercio)')
    .eq('id', orderId)
    .eq('usuario_id', user.id)
    .maybeSingle();

  if (orderError) {
    const message = getSupabaseErrorMessage(orderError);
    if (isPermissionError(orderError)) {
      throw new Error('No tienes permisos para consultar este pedido.');
    }
    if (isMissingTableError(orderError)) {
      throw new Error('La tabla de pedidos no está disponible en Supabase.');
    }
    throw new Error(message || 'No se pudo cargar el pedido.');
  }

  if (!pedido) return null;

  const [detailsResult, historyResult] = await Promise.all([
    supabase.from('pedido_detalles').select('*').eq('pedido_id', orderId),
    supabase.from('pedido_estado_historial').select('*').eq('pedido_id', orderId).order('created_at'),
  ]);

  if (detailsResult.error) {
    const message = getSupabaseErrorMessage(detailsResult.error);
    if (isPermissionError(detailsResult.error)) {
      throw new Error('No tienes permisos para consultar los detalles de este pedido.');
    }
    if (isMissingTableError(detailsResult.error)) {
      throw new Error('La tabla pedido_detalles no está disponible en Supabase.');
    }
    throw new Error(message || 'No se pudieron cargar los detalles del pedido.');
  }

  if (historyResult.error) {
    const message = getSupabaseErrorMessage(historyResult.error);
    if (isPermissionError(historyResult.error)) {
      throw new Error('No tienes permisos para consultar el historial de este pedido.');
    }
    if (isMissingTableError(historyResult.error)) {
      throw new Error('La tabla pedido_estado_historial no está disponible en Supabase.');
    }
    throw new Error(message || 'No se pudo cargar el historial del pedido.');
  }

  return {
    pedido: pedido as unknown as PedidoConTienda,
    detalles: (detailsResult.data || []) as PedidoDetalle[],
    historial: (historyResult.data || []) as PedidoEstadoHistorial[],
  };
}

export async function getMyStoreOrders(): Promise<PedidoConTienda[]> {
  const user = await getCurrentUser();

  const { data, error } = await supabase.rpc('obtener_pedidos_mis_tiendas');

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (isPermissionError(error)) {
      throw new Error('No tienes permisos para consultar los pedidos de tu tienda.');
    }
    if (isMissingTableError(error)) {
      throw new Error('La función obtener_pedidos_mis_tiendas no está disponible en Supabase.');
    }
    throw new Error(message || 'No se pudieron cargar los pedidos de tu tienda.');
  }

  return (data || []) as unknown as PedidoConTienda[];
}

export async function getStoreOrderById(orderId: string) {
  const orders = await getMyStoreOrders();
  const pedido = orders.find((order) => order.id === orderId) ?? null;

  if (!pedido) return null;

  const [detailsResult, historyResult] = await Promise.all([
    supabase.from('pedido_detalles').select('*').eq('pedido_id', orderId),
    supabase.from('pedido_estado_historial').select('*').eq('pedido_id', orderId).order('created_at'),
  ]);

  if (detailsResult.error) {
    const message = getSupabaseErrorMessage(detailsResult.error);
    if (isPermissionError(detailsResult.error)) {
      throw new Error('No tienes permisos para consultar los detalles de este pedido.');
    }
    if (isMissingTableError(detailsResult.error)) {
      throw new Error('La tabla pedido_detalles no está disponible en Supabase.');
    }
    throw new Error(message || 'No se pudieron cargar los detalles del pedido.');
  }

  if (historyResult.error) {
    const message = getSupabaseErrorMessage(historyResult.error);
    if (isPermissionError(historyResult.error)) {
      throw new Error('No tienes permisos para consultar el historial de este pedido.');
    }
    if (isMissingTableError(historyResult.error)) {
      throw new Error('La tabla pedido_estado_historial no está disponible en Supabase.');
    }
    throw new Error(message || 'No se pudo cargar el historial del pedido.');
  }

  return {
    pedido: pedido as unknown as PedidoConTienda,
    detalles: (detailsResult.data || []) as PedidoDetalle[],
    historial: (historyResult.data || []) as PedidoEstadoHistorial[],
  };
}

export async function updateVendorOrderStatus(orderId: string, nextState: string, observacion?: string) {
  const currentOrder = await getStoreOrderById(orderId);
  if (!currentOrder) {
    throw new Error('No se encontró este pedido para tu tienda.');
  }

  const allowedTransitions = ORDER_STATUS_FLOW[currentOrder.pedido.estado] ?? [];
  if (!allowedTransitions.includes(nextState)) {
    throw new Error('La transición de estado no está permitida para este pedido.');
  }

  const { data, error } = await supabase.rpc('actualizar_estado_pedido', {
    p_pedido_id: orderId,
    p_nuevo_estado: nextState,
    p_observacion: observacion ?? `Estado actualizado por el comerciante a ${getOrderStateLabel(nextState)}.`,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error);
    if (isPermissionError(error)) {
      throw new Error('No tienes permisos para actualizar este pedido.');
    }
    if (isMissingTableError(error)) {
      throw new Error('La función actualizar_estado_pedido no está disponible en Supabase.');
    }
    throw new Error(message || 'No se pudo actualizar el estado del pedido.');
  }

  return (data || { id: orderId, estado: nextState }) as {
    id: string;
    pedido_id?: string;
    estado?: string;
    estado_anterior?: string | null;
    estado_nuevo?: string | null;
  };
}