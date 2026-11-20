import type { PedidoConTienda } from '@/services/orders.service';
import type { PedidoDetalle } from '@/types/database';
import type { jsPDF as JsPDF } from 'jspdf';
import { readThemeRgb } from '@/lib/appearance';

export type OrderTicketData = {
  pedido: PedidoConTienda;
  detalles: PedidoDetalle[];
};

export const APP_NAME = 'Portal Guairá · Multitienda';

export const formatGs = (value: number | string | null | undefined) =>
  `Gs. ${Number(value ?? 0).toLocaleString('es-PY')}`;

export const formatTicketDate = (value: string) =>
  new Date(value).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });

export const humanize = (value: string | null | undefined) => {
  const text = String(value ?? '').replaceAll('_', ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '-';
};

/** PG-20261116-<32 hex>  ->  PG-20261116-FBB2A1CF (código corto para mostrar). */
export const shortOrderNumber = (numero: string) => {
  const match = /^([A-Z]+-\d{8}-)([0-9A-F]{8})[0-9A-F]*$/i.exec(numero);
  return match ? `${match[1]}${match[2]}`.toUpperCase() : numero;
};

/** Datos que el pedido por WhatsApp guarda en notas: canal, cliente y pago real. */
export const parseOrderNotes = (notas: string | null | undefined) => {
  const text = notas ?? '';
  const viaWhatsApp = /pedido enviado por whatsapp/i.test(text);
  const cliente = /Cliente:\s*([^.]+)\./i.exec(text)?.[1]?.trim() ?? null;
  const pago = /Pago:\s*([^.]+)\./i.exec(text)?.[1]?.trim() ?? null;
  const resto = viaWhatsApp
    ? text.replace(/pedido enviado por whatsapp\.?/i, '').replace(/Cliente:\s*[^.]+\./i, '').replace(/Pago:\s*[^.]+\./i, '').trim()
    : text.trim();
  return { canal: viaWhatsApp ? 'WhatsApp' : 'Web', cliente, pago, notasLibres: resto || null };
};

/** Dominio público para los enlaces (NEXT_PUBLIC_SITE_URL en producción; si no, el actual). */
export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || (typeof window === 'undefined' ? '' : window.location.origin)).replace(/\/$/, '');

export const orderUrl = (pedidoId: string) => `${siteUrl()}/pedidos/${pedidoId}`;

export const productUrl = (tiendaSlug: string | null | undefined, productoId: string | null) =>
  tiendaSlug ? `${siteUrl()}/tienda/${tiendaSlug}${productoId ? `#product-${productoId}` : ''}` : null;

/** Número de WhatsApp en formato internacional de Paraguay (0981123456 -> 595981123456). */
export const whatsappPhone = (raw: string | null | undefined) => {
  let phone = String(raw ?? '').replace(/\D/g, '');
  if (!phone) return null;
  if (phone.startsWith('0')) phone = `595${phone.slice(1)}`;
  else if (!phone.startsWith('595')) phone = `595${phone}`;
  return phone;
};

/**
 * Texto que acompaña a la imagen del ticket en WhatsApp: resumen y, debajo, el enlace de cada producto.
 * Solo símbolos del plano básico Unicode (los emojis de 4 bytes se corrompen en WhatsApp Web/Desktop).
 */
export const buildTicketWhatsAppText = ({ pedido, detalles }: OrderTicketData) => {
  const meta = parseOrderNotes(pedido.notas);
  const lines = [
    `✦ *Ticket ${shortOrderNumber(pedido.numero_pedido)}* · ${pedido.tienda?.nombre_comercio || 'Tienda'}`,
  ];
  if (meta.cliente) lines.push(`*Cliente:* ${meta.cliente}`);
  lines.push(
    `*Total:* ${formatGs(pedido.total)} · ${meta.pago || humanize(pedido.metodo_pago)}`,
    `*Entrega:* ${pedido.direccion_entrega || '-'}`,
    '',
    '*Productos:*',
  );
  detalles.forEach((item) => {
    lines.push(`▸ ${item.cantidad} × ${item.nombre_producto_snapshot}`);
    const link = productUrl(pedido.tienda?.slug, item.producto_id);
    if (link) lines.push(`   ${link}`);
  });
  lines.push('', `Ver pedido en el panel: ${siteUrl()}/vendedor/pedidos/${pedido.id}`);
  return lines.join('\n');
};

export async function orderQrDataUrl(pedidoId: string) {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(orderUrl(pedidoId), {
    margin: 0,
    width: 320,
    errorCorrectionLevel: 'M',
    color: { dark: '#1f1724', light: '#ffffff' },
  });
}

// ---------------------------------------------------------------------------
// PDF tipo ticket térmico de 80 mm
// ---------------------------------------------------------------------------
const W = 80;
const M = 5;
const RIGHT = W - M;
const CW = W - M * 2;

// Colores del tema activo (personalización del usuario); valores de respaldo = tema Rosa boutique.
const ticketColors = () => ({
  PINK: readThemeRgb('primary', 600, [219, 39, 119]),
  PINK_DARK: readThemeRgb('primary', 800, [157, 23, 77]),
  PINK_SOFT: readThemeRgb('primary', 50, [253, 242, 248]),
  INK: readThemeRgb('slate', 900, [31, 23, 36]),
  MUTED: readThemeRgb('slate', 500, [123, 112, 130]),
  LINE: readThemeRgb('slate', 200, [238, 231, 240]),
});
const GREEN: [number, number, number] = [4, 120, 87];

function drawTicket(pdf: JsPDF, data: OrderTicketData, qr: string | null): number {
  const { PINK, PINK_DARK, PINK_SOFT, INK, MUTED, LINE } = ticketColors();
  const { pedido, detalles } = data;
  const meta = parseOrderNotes(pedido.notas);
  const center = W / 2;
  let y = 0;

  const color = (rgb: [number, number, number]) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
  const fill = (rgb: [number, number, number]) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
  const draw = (rgb: [number, number, number]) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const font = (style: 'normal' | 'bold', size: number) => { pdf.setFont('helvetica', style); pdf.setFontSize(size); };
  const dashed = (gap = 4) => {
    draw(MUTED);
    pdf.setLineWidth(0.2);
    pdf.setLineDashPattern([0.8, 0.8], 0);
    pdf.line(M, y, RIGHT, y);
    pdf.setLineDashPattern([], 0);
    y += gap;
  };
  const label = (text: string) => {
    font('bold', 6.5);
    color(MUTED);
    pdf.text(text.toUpperCase(), M, y, { charSpace: 0.3 });
    y += 3.6;
  };

  // --- Cabecera de marca -----------------------------------------------------
  fill(PINK);
  pdf.rect(0, 0, W, 24, 'F');
  fill(PINK_DARK);
  pdf.rect(0, 24, W, 1.2, 'F');
  color([255, 255, 255]);
  font('bold', 13);
  const tienda = pdf.splitTextToSize(pedido.tienda?.nombre_comercio || 'Tienda', CW) as string[];
  pdf.text(tienda[0], center, 11, { align: 'center' });
  font('normal', 7);
  pdf.text(APP_NAME, center, 16.5, { align: 'center' });
  font('bold', 6.5);
  pdf.text(`PEDIDO VÍA ${meta.canal.toUpperCase()}`, center, 21, { align: 'center', charSpace: 0.4 });
  y = 32;

  // --- Número de ticket ------------------------------------------------------
  font('bold', 7);
  color(MUTED);
  pdf.text('TICKET DE PEDIDO', center, y, { align: 'center', charSpace: 0.6 });
  y += 6;
  font('bold', 14);
  color(INK);
  pdf.text(shortOrderNumber(pedido.numero_pedido), center, y, { align: 'center' });
  y += 5;

  // Insignia de estado
  const estado = humanize(pedido.estado).toUpperCase();
  font('bold', 7);
  const badgeW = pdf.getTextWidth(estado) + 8;
  fill(PINK_SOFT);
  draw(PINK);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(center - badgeW / 2, y - 1, badgeW, 5.5, 2.7, 2.7, 'FD');
  color(PINK_DARK);
  pdf.text(estado, center, y + 2.8, { align: 'center' });
  y += 10;

  // --- Datos del pedido (2 columnas) ----------------------------------------
  const fecha = new Date(pedido.created_at);
  const info: Array<[string, string]> = [
    ['Fecha', fecha.toLocaleDateString('es-PY')],
    ['Hora', fecha.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })],
    ['Método de pago', meta.pago || humanize(pedido.metodo_pago)],
    ['Estado de pago', humanize(pedido.estado_pago)],
  ];
  if (meta.cliente) info.unshift(['Cliente', meta.cliente]);
  const colW = CW / 2;
  for (let i = 0; i < info.length; i += 2) {
    [info[i], info[i + 1]].forEach((cell, col) => {
      if (!cell) return;
      const x = M + col * colW;
      font('bold', 6);
      color(MUTED);
      pdf.text(cell[0].toUpperCase(), x, y, { charSpace: 0.2 });
      font('bold', 8);
      color(INK);
      pdf.text((pdf.splitTextToSize(cell[1], colW - 2) as string[])[0], x, y + 3.8);
    });
    y += 9;
  }
  y += 1;
  dashed(5);

  // --- Detalle de productos ---------------------------------------------------
  fill(PINK_SOFT);
  pdf.rect(M, y - 3.6, CW, 5.4, 'F');
  font('bold', 6.5);
  color(PINK_DARK);
  pdf.text('PRODUCTO', M + 1.5, y, { charSpace: 0.2 });
  pdf.text('CANT.', M + 44, y, { align: 'center' });
  pdf.text('IMPORTE', RIGHT - 1.5, y, { align: 'right' });
  y += 5.5;

  detalles.forEach((item, index) => {
    font('bold', 8);
    const nombre = pdf.splitTextToSize(item.nombre_producto_snapshot, 36) as string[];
    const rowH = nombre.length * 3.6 + 4.2;
    if (index % 2 === 1) {
      fill([250, 247, 250]);
      pdf.rect(M, y - 3.4, CW, rowH + 0.6, 'F');
    }
    color(INK);
    pdf.text(nombre, M + 1.5, y);
    font('normal', 8);
    pdf.text(String(item.cantidad), M + 44, y, { align: 'center' });
    font('bold', 8);
    pdf.text(formatGs(item.subtotal), RIGHT - 1.5, y, { align: 'right' });
    y += nombre.length * 3.6;
    font('normal', 6.5);
    color(MUTED);
    const desc = Number(item.descuento) > 0 ? `  ·  Ahorro ${formatGs(item.descuento)}` : '';
    pdf.text(`${formatGs(item.precio)} c/u${desc}`, M + 1.5, y);
    y += 4.6;
  });
  y += 1;

  // --- Totales -----------------------------------------------------------------
  const totalRow = (k: string, v: string, rgb = MUTED) => {
    font('normal', 8);
    color(MUTED);
    pdf.text(k, M + 1.5, y);
    color(rgb);
    pdf.text(v, RIGHT - 1.5, y, { align: 'right' });
    y += 4.4;
  };
  draw(LINE);
  pdf.setLineWidth(0.3);
  pdf.line(M, y - 2, RIGHT, y - 2);
  y += 2.5;
  totalRow('Subtotal', formatGs(pedido.subtotal), INK);
  if (Number(pedido.descuento) > 0) totalRow('Descuentos', `- ${formatGs(pedido.descuento)}`, GREEN);
  totalRow('Envío', Number(pedido.envio) > 0 ? formatGs(pedido.envio) : 'A coordinar', INK);
  y += 1;
  fill(PINK);
  pdf.roundedRect(M, y - 1, CW, 10, 2, 2, 'F');
  color([255, 255, 255]);
  font('bold', 8);
  pdf.text('TOTAL A PAGAR', M + 3, y + 5.2, { charSpace: 0.3 });
  font('bold', 12);
  pdf.text(formatGs(pedido.total), RIGHT - 3, y + 5.6, { align: 'right' });
  y += 15;

  // --- Entrega -------------------------------------------------------------
  label('Dirección de entrega');
  font('normal', 8);
  color(INK);
  const dir = pdf.splitTextToSize(pedido.direccion_entrega || '-', CW) as string[];
  pdf.text(dir, M, y);
  y += dir.length * 3.6 + 2;
  if (meta.notasLibres) {
    label('Notas');
    font('normal', 8);
    color(INK);
    const notas = pdf.splitTextToSize(meta.notasLibres, CW) as string[];
    pdf.text(notas, M, y);
    y += notas.length * 3.6 + 2;
  }
  y += 1;
  dashed(6);

  // --- QR ----------------------------------------------------------------------
  if (qr) {
    const size = 28;
    draw(LINE);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(center - size / 2 - 2, y - 2, size + 4, size + 4, 2, 2, 'S');
    pdf.addImage(qr, 'PNG', center - size / 2, y, size, size);
    y += size + 6;
    font('bold', 7.5);
    color(INK);
    pdf.text('Escaneá para seguir tu pedido', center, y, { align: 'center' });
    y += 6;
  }

  // --- Pie -----------------------------------------------------------------------
  font('bold', 10);
  color(PINK);
  pdf.text('¡Gracias por tu compra!', center, y, { align: 'center' });
  y += 4.5;
  font('normal', 6.5);
  color(MUTED);
  pdf.text('Presentá este ticket al retirar o recibir tu pedido.', center, y, { align: 'center' });
  y += 5;
  font('normal', 5.5);
  pdf.text(`Ref. ${pedido.numero_pedido}`, center, y, { align: 'center' });
  y += 3;
  pdf.text(`Emitido el ${new Date().toLocaleString('es-PY')}`, center, y, { align: 'center' });
  y += 5;

  // Borde inferior dentado (corte de ticket)
  fill(PINK);
  const teeth = 16;
  const step = W / teeth;
  for (let i = 0; i < teeth; i += 1) {
    pdf.triangle(i * step, y + 2.5, (i + 0.5) * step, y, (i + 1) * step, y + 2.5, 'F');
  }
  return y + 2.5;
}

export async function downloadOrderTicketPdf(data: OrderTicketData) {
  const [{ jsPDF }, qr] = await Promise.all([
    import('jspdf'),
    orderQrDataUrl(data.pedido.id).catch(() => null),
  ]);
  // Primera pasada para medir la altura; la segunda genera el ticket del tamaño exacto.
  const height = drawTicket(new jsPDF({ unit: 'mm', format: [W, 1000] }), data, qr);
  const pdf = new jsPDF({ unit: 'mm', format: [W, height], compress: true });
  pdf.setProperties({
    title: `Ticket ${shortOrderNumber(data.pedido.numero_pedido)}`,
    subject: 'Ticket de pedido',
    author: data.pedido.tienda?.nombre_comercio || APP_NAME,
    creator: APP_NAME,
  });
  drawTicket(pdf, data, qr);
  pdf.save(`ticket-${shortOrderNumber(data.pedido.numero_pedido)}.pdf`);
}
