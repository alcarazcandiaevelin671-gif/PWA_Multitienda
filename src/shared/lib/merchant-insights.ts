/**
 * [SHARED] Indicadores orientativos del comerciante (función pura): estadística simple, no un modelo predictivo.
 * Los pedidos cancelados no cuentan.
 */
export type InsightOrder = { estado: string; total: number | string | null; created_at: string; eliminado_en?: string | null };
export type InsightProduct = { titulo: string; stock: number | null; stock_minimo: number | null };

const DAY_MS = 86_400_000;

export function buildMerchantInsights(orders: InsightOrder[], products: InsightProduct[], now: Date) {
  const total = (fromDays: number, toDays: number) => orders
    .filter((order) => order.estado !== 'cancelado' && !order.eliminado_en)
    .filter((order) => {
      const age = now.getTime() - new Date(order.created_at).getTime();
      return age >= toDays * DAY_MS && age < fromDays * DAY_MS;
    })
    .reduce((sum, order) => sum + (Number(order.total ?? 0) || 0), 0);

  const current = total(7, 0);
  const previous = total(14, 7);
  return {
    proyeccionMes: Math.round((current / 7) * 30),
    /** Variación semanal en %, o `null` si no hay ventas previas con qué comparar. */
    tendencia: previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10,
    /** Productos con control de stock que llegaron a su aviso (o se agotaron). */
    porReponer: products.filter((product) => product.stock != null && product.stock <= Math.max(0, product.stock_minimo ?? 0)).map((product) => product.titulo),
  };
}

export type MerchantInsights = ReturnType<typeof buildMerchantInsights>;
