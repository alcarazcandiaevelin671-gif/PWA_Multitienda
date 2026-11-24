/**
 * [SHARED] Cálculo del reporte global de administración (función pura, sin acceso a datos).
 * Recibe filas ya leídas y devuelve totales; así se puede probar sin base de datos.
 */
export type ReportOrder = { id: string; tienda_id: string; estado: string; total: number | string | null; created_at: string };
export type ReportShop = { id: string; nombre_comercio: string | null; estado: string | null; distrito: string | null };
export type ReportUser = { rol: string | null; creado_en: string };

export const ORDER_STATES = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'completado', 'cancelado'] as const;

const amount = (value: number | string | null) => Number(value ?? 0) || 0;

export function buildAdminReport(input: { orders: ReportOrder[]; shops: ReportShop[]; users: ReportUser[] }) {
  const { orders, shops, users } = input;
  const ordersByState = Object.fromEntries(ORDER_STATES.map((state) => [state, orders.filter((order) => order.estado === state).length]));
  const notCancelled = orders.filter((order) => order.estado !== 'cancelado');
  const orderTotal = notCancelled.reduce((sum, order) => sum + amount(order.total), 0);

  const byShop = shops
    .map((shop) => {
      const shopOrders = orders.filter((order) => order.tienda_id === shop.id);
      const valid = shopOrders.filter((order) => order.estado !== 'cancelado');
      return {
        comercio: shop.nombre_comercio ?? 'Comercio',
        distrito: shop.distrito ?? 'Sin distrito',
        estado: shop.estado ?? '',
        pedidos: shopOrders.length,
        cancelados: shopOrders.length - valid.length,
        total: valid.reduce((sum, order) => sum + amount(order.total), 0),
      };
    })
    .sort((left, right) => right.total - left.total || left.comercio.localeCompare(right.comercio));

  const districts = new Map<string, { distrito: string; comercios: number; pedidos: number; total: number }>();
  for (const row of byShop) {
    const entry = districts.get(row.distrito) ?? { distrito: row.distrito, comercios: 0, pedidos: 0, total: 0 };
    entry.comercios += 1;
    entry.pedidos += row.pedidos;
    entry.total += row.total;
    districts.set(row.distrito, entry);
  }

  return {
    resumen: {
      pedidos: orders.length,
      pedidosNoCancelados: notCancelled.length,
      montoPedidos: orderTotal,
      promedioPorPedido: notCancelled.length ? orderTotal / notCancelled.length : 0,
      usuariosNuevos: users.length,
      clientesNuevos: users.filter((user) => user.rol === 'cliente').length,
      comerciantesNuevos: users.filter((user) => user.rol === 'comerciante').length,
    },
    pedidosPorEstado: ordersByState as Record<(typeof ORDER_STATES)[number], number>,
    porComercio: byShop,
    porDistrito: [...districts.values()].sort((left, right) => right.total - left.total || left.distrito.localeCompare(right.distrito)),
  };
}

export type AdminReport = ReturnType<typeof buildAdminReport>;
