'use client';

/* eslint-disable @next/next/no-img-element -- el QR es un data URL generado en el cliente */
import { useEffect, useRef, useState } from 'react';
import {
  APP_NAME,
  buildTicketWhatsAppText,
  downloadOrderTicketPdf,
  whatsappPhone,
  formatGs,
  humanize,
  orderQrDataUrl,
  parseOrderNotes,
  shortOrderNumber,
  type OrderTicketData,
} from '@/lib/order-ticket';
import { userFacingError } from '@/lib/user-facing-error';

const Divider = () => <div className="my-4 border-t-2 border-dashed border-slate-200" />;

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="truncate text-xs font-bold text-slate-800">{value}</p>
  </div>
);

type OrderTicketProps = OrderTicketData & {
  /** Resalta el botón de WhatsApp (el cliente viene de "Realizar pedido por WhatsApp"). */
  highlightWhatsApp?: boolean;
};

async function renderTicketPng(node: HTMLElement): Promise<Blob> {
  const { toBlob } = await import('html-to-image');
  const options = {
    pixelRatio: 2,
    backgroundColor: '#ffffff', // WhatsApp convierte a JPG: sin fondo, las esquinas saldrían negras
    style: { margin: '0', boxShadow: 'none' },
  };
  // Si falla la incrustación de fuentes, se reintenta sin ellas.
  const blob = await toBlob(node, options).catch(() => toBlob(node, { ...options, skipFonts: true }));
  if (!blob) throw new Error('No se pudo generar la imagen del ticket.');
  return blob;
}

export default function OrderTicket({ pedido, detalles, highlightWhatsApp = false }: OrderTicketProps) {
  const ticketRef = useRef<HTMLElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareHint, setShareHint] = useState('');
  const [error, setError] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  // Imagen pre-generada: navigator.share exige ejecutarse poco después del clic.
  const pngCache = useRef<Blob | null>(null);

  useEffect(() => {
    if (!qr || !ticketRef.current) return;
    let active = true;
    const node = ticketRef.current;
    const timer = window.setTimeout(() => {
      renderTicketPng(node).then((blob) => { if (active) pngCache.current = blob; }).catch(() => undefined);
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [qr]);
  const meta = parseOrderNotes(pedido.notas);
  const fecha = new Date(pedido.created_at);

  useEffect(() => {
    let active = true;
    orderQrDataUrl(pedido.id).then((url) => { if (active) setQr(url); }).catch(() => undefined);
    return () => { active = false; };
  }, [pedido.id]);

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      await downloadOrderTicketPdf({ pedido, detalles });
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo generar el ticket.'));
    } finally {
      setDownloading(false);
    }
  };

  /**
   * mode "app": menú Compartir del sistema (imagen + texto) o, si no existe, api.whatsapp.com.
   * mode "web": WhatsApp Web; la imagen se copia al portapapeles para pegarla con Ctrl+V.
   */
  const handleShareWhatsApp = async (mode: 'app' | 'web') => {
    if (!ticketRef.current) return;
    setSharing(true);
    setError('');
    setShareHint('');
    const text = buildTicketWhatsAppText({ pedido, detalles });
    const filename = `ticket-${shortOrderNumber(pedido.numero_pedido)}.png`;
    const phone = whatsappPhone(pedido.tienda?.whatsapp || pedido.tienda?.telefono);
    const query = `${phone ? `phone=${phone}&` : ''}text=${encodeURIComponent(text)}`;
    const downloadPng = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: filename }).click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };
    // Copiar la imagen antes de abrir WhatsApp: el portapapeles exige que esta página tenga el foco.
    const copyPng = async (blob: Blob) => {
      try {
        if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return true;
      } catch {
        return false;
      }
    };
    const pasteHint = (where: string, copied: boolean) => (copied
      ? `Se abrió ${where} en el chat del comercio. La IMAGEN del ticket ya está copiada: presioná Ctrl+V (⌘+V en Mac) en el chat y luego Enviar. Los enlaces de los productos van como texto debajo.`
      : `Se abrió ${where}. Se descargó "${filename}": arrastrá esa imagen al chat o adjuntala con 📎 y luego Enviar.`);

    try {
      const blob = pngCache.current ?? await renderTicketPng(ticketRef.current);

      if (mode === 'web') {
        const copied = await copyPng(blob);
        if (!copied) downloadPng(blob);
        window.open(`https://web.whatsapp.com/send?${query}`, '_blank');
        setShareHint(pasteHint('WhatsApp Web', copied));
        return;
      }

      // 1) Compartir imagen + texto (celulares y Windows): WhatsApp muestra el texto debajo de la imagen.
      const file = new File([blob], filename, { type: 'image/png' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, title: `Ticket ${shortOrderNumber(pedido.numero_pedido)}` });
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === 'AbortError') return; // el cliente canceló
        }
      }

      // 2) Sin "Compartir" (navegadores de escritorio): copiar la imagen y abrir WhatsApp para pegarla.
      const copied = await copyPng(blob);
      if (!copied) downloadPng(blob);
      window.open(`https://api.whatsapp.com/send?${query}`, '_blank');
      setShareHint(pasteHint('WhatsApp', copied));
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudo preparar el ticket para WhatsApp.'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="w-full">
      <article
        ref={ticketRef}
        aria-label={`Ticket del pedido ${shortOrderNumber(pedido.numero_pedido)}`}
        className="print-ticket relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-white text-sm shadow-[0_24px_60px_rgba(219,39,119,0.16)] ring-1 ring-slate-200"
      >
        <header className="bg-gradient-to-br from-primary-600 to-accent-600 px-5 pb-5 pt-6 text-center text-white">
          <p className="text-lg font-black leading-tight">{pedido.tienda?.nombre_comercio || 'Tienda'}</p>
          <p className="text-xs text-white/80">{APP_NAME}</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
            Pedido vía {meta.canal}
          </span>
        </header>

        <div className="px-5 pb-6 pt-5">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">Ticket de pedido</p>
            <p className="mt-1 font-mono text-xl font-black tracking-tight text-slate-900">{shortOrderNumber(pedido.numero_pedido)}</p>
            <span className="mt-2 inline-block rounded-full border border-primary-300 bg-primary-50 px-3 py-0.5 text-[11px] font-black uppercase text-primary-700">
              {humanize(pedido.estado)}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
            {meta.cliente && <div className="col-span-2"><Info label="Cliente" value={meta.cliente} /></div>}
            <Info label="Fecha" value={fecha.toLocaleDateString('es-PY')} />
            <Info label="Hora" value={fecha.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} />
            <Info label="Método de pago" value={meta.pago || humanize(pedido.metodo_pago)} />
            <Info label="Estado de pago" value={humanize(pedido.estado_pago)} />
          </div>

          <Divider />

          <div className="flex justify-between rounded-lg bg-primary-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-800">
            <span>Producto</span>
            <span>Importe</span>
          </div>
          <ul className="mt-1">
            {detalles.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 rounded-lg px-3 py-2 text-xs even:bg-slate-50">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800">
                    <span className="mr-1 text-primary-600">{item.cantidad}×</span>
                    {item.nombre_producto_snapshot}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatGs(item.precio)} c/u
                    {Number(item.descuento) > 0 && <span className="text-emerald-700"> · Ahorro {formatGs(item.descuento)}</span>}
                  </p>
                </div>
                <span className="whitespace-nowrap font-black text-slate-900">{formatGs(item.subtotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-3 space-y-1.5 border-t border-slate-100 px-3 pt-3 text-xs">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="font-semibold text-slate-800">{formatGs(pedido.subtotal)}</dd></div>
            {Number(pedido.descuento) > 0 && (
              <div className="flex justify-between"><dt className="text-slate-500">Descuentos</dt><dd className="font-semibold text-emerald-700">- {formatGs(pedido.descuento)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-slate-500">Envío</dt><dd className="font-semibold text-slate-800">{Number(pedido.envio) > 0 ? formatGs(pedido.envio) : 'A coordinar'}</dd></div>
          </dl>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary-600 to-accent-600 px-4 py-3 text-white">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total a pagar</span>
            <span className="text-lg font-black">{formatGs(pedido.total)}</span>
          </div>

          <div className="mt-4 text-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dirección de entrega</p>
            <p className="break-words font-semibold text-slate-800">{pedido.direccion_entrega || '-'}</p>
            {meta.notasLibres && (
              <>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Notas</p>
                <p className="break-words text-slate-700">{meta.notasLibres}</p>
              </>
            )}
          </div>

          <Divider />

          <div className="flex flex-col items-center text-center">
            {qr ? (
              <img src={qr} alt="Código QR para seguir el pedido" className="h-28 w-28 rounded-xl border border-slate-200 p-1.5" />
            ) : (
              <div className="h-28 w-28 animate-pulse rounded-xl bg-slate-100" />
            )}
            <p className="mt-2 text-xs font-bold text-slate-700">Escaneá para seguir tu pedido</p>
            <p className="mt-3 font-black text-primary-600">¡Gracias por tu compra!</p>
            <p className="text-[11px] text-slate-500">Presentá este ticket al retirar o recibir tu pedido.</p>
            <p className="mt-2 break-all font-mono text-[9px] text-slate-400">Ref. {pedido.numero_pedido}</p>
          </div>
        </div>
      </article>

      <div className={`no-print mx-auto mt-4 max-w-sm rounded-2xl ${highlightWhatsApp ? 'animate-pulse ring-4 ring-[#25D366]/30' : ''}`}>
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Enviar ticket por WhatsApp</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleShareWhatsApp('app')}
            disabled={sharing}
            title="Abre WhatsApp (celular o aplicación de escritorio) con la imagen del ticket"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-3 text-sm font-black text-white shadow-md transition hover:bg-[#1ebe5b] disabled:opacity-60"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12.031 2c-5.514 0-9.999 4.486-9.999 10 0 1.763.457 3.42 1.258 4.869l-1.337 4.887 5.006-1.313c1.401.763 2.998 1.196 4.673 1.196 5.513 0 10.024-4.486 10.024-10s-4.511-10-10.025-10z" />
            </svg>
            {sharing ? 'Preparando…' : 'WhatsApp'}
          </button>
          <button
            type="button"
            onClick={() => handleShareWhatsApp('web')}
            disabled={sharing}
            title="Abre web.whatsapp.com en el navegador; la imagen del ticket se copia para pegarla con Ctrl+V"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] bg-white px-3 py-3 text-sm font-black text-[#128C7E] transition hover:bg-[#25D366]/10 disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8M12 16v4" />
            </svg>
            {sharing ? 'Preparando…' : 'WhatsApp Web'}
          </button>
        </div>
      </div>
      {shareHint && (
        <p role="status" className="no-print mx-auto mt-3 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {shareHint}
        </p>
      )}
      <div className="no-print mx-auto mt-2 flex max-w-sm gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:opacity-60"
        >
          {downloading ? 'Generando…' : '⬇ Descargar PDF'}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-primary-300 hover:text-primary-700"
        >
          🖨 Imprimir
        </button>
      </div>
      {error && <p role="alert" className="no-print mx-auto mt-3 max-w-sm text-sm text-rose-700">{error}</p>}
    </div>
  );
}
