'use client';

/**
 * [FRONTEND] Carrito lateral MULTITIENDA: productos agrupados por comercio, sugerencias complementarias
 * (IA), datos de entrega y pago. Registra un pedido por comercio (o los guarda sin conexión) y lleva al
 * ticket (un comercio) o a /pedidos/enviar (varios) para mandar cada pedido por WhatsApp.
 */
import { useEffect, useState } from 'react';
import { useCart } from '@/frontend/context/CartContext';
import { Shop } from '@/shared/types/shop';
import { supabase } from '@/shared/supabase/client';
import { getStoredLocation } from '@/frontend/lib/location-consent';
import { showAppMessage } from '@/frontend/lib/app-message';
import { getMaxQuantity } from '@/shared/lib/product-pricing';
import PriceTag from '@/frontend/components/products/PriceTag';
import { userFacingError } from '@/shared/lib/user-facing-error';
import { afterCheckoutPath, submitOrdersByShop } from '@/frontend/lib/multi-store-checkout';
import { fetchComplementaryProducts, type AIRecommendation } from '@/frontend/lib/recommendations-client';
import Image from 'next/image';
import Link from 'next/link';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentShop?: Shop | null;
}

export default function CartDrawer({ isOpen, onClose, currentShop }: CartDrawerProps) {
  const { items, addItem, removeItem, updateQuantity, totalAmount, shopGroups } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiration, setCardExpiration] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [deliveryEstimate, setDeliveryEstimate] = useState('30 a 45 minutos');

  // Productos complementarios (filtrado colaborativo: "otros clientes también llevaron")
  const [complements, setComplements] = useState<AIRecommendation[]>([]);
  const cartKey = items.map(({ product }) => product.id).sort().join(',');
  useEffect(() => {
    if (!isOpen || !cartKey) { setComplements([]); return; }
    let active = true;
    fetchComplementaryProducts(cartKey.split(','), 3)
      .then((list) => { if (active) setComplements(list); })
      .catch(() => { if (active) setComplements([]); });
    return () => { active = false; };
  }, [isOpen, cartKey]);

  if (!isOpen) return null;

  /** Estimación orientativa según la distancia. Usa SOLO la ubicación que el usuario ya consintió; nunca pide el GPS. */
  const obtenerEstimacionEntrega = (): string => {
    const location = getStoredLocation();
    if (!location || currentShop?.latitud == null || currentShop?.longitud == null) return '30 a 45 minutos';
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const deltaLat = toRadians(currentShop.latitud - location.latitude);
    const deltaLng = toRadians(currentShop.longitud - location.longitude);
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(toRadians(location.latitude)) * Math.cos(toRadians(currentShop.latitud)) * Math.sin(deltaLng / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distanceKm > 10 ? '60 a 90 minutos' : distanceKm > 5 ? '45 a 60 minutos' : '30 a 45 minutos';
  };

  const handleSendOrder = async () => {
    // Si el carrito es solo de la tienda que se está viendo, se avisa antes si no tiene WhatsApp.
    // Con varios comercios, la página /pedidos/enviar avisa por cada uno.
    if (shopGroups.length === 1 && currentShop?.id === shopGroups[0].tienda_id && !currentShop?.whatsapp && !currentShop?.telefono) {
      showAppMessage('El comercio no tiene configurado un número de WhatsApp.', 'Compra no disponible', 'error');
      return;
    }

    if (!customerName.trim() || customerAddress.trim().length < 3) {
      showAppMessage('Completa tu nombre y dirección de entrega.', 'Datos incompletos', 'error');
      return;
    }

    if (paymentMethod === 'en_linea' && (!cardNumber || !cardExpiration || !cardCvc)) {
      showAppMessage('Completa los datos de la tarjeta para continuar.', 'Pago no válido', 'error');
      return;
    }

    const selectedPaymentMethod = paymentMethod === 'en_linea'
      ? 'Compra en Línea (demostración, sin cobro real)'
      : paymentMethod;

    // getSession() lee la sesión guardada en el dispositivo: funciona sin conexión.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      showAppMessage('Debes iniciar sesión para completar tu compra.', 'Inicio de sesión requerido', 'error');
      window.location.href = '/auth/login';
      return;
    }

    // Multitienda: un pedido por comercio, con los mismos datos de entrega y pago.
    setPaymentStatus('processing');
    const result = await submitOrdersByShop(shopGroups, {
      metodo_pago: (paymentMethod === 'Efectivo' ? 'efectivo' : 'transferencia') as 'efectivo' | 'transferencia',
      direccion_entrega: customerAddress.trim(),
      notas: `Pedido enviado por WhatsApp. Cliente: ${customerName.trim()}. Pago: ${selectedPaymentMethod}.`,
    }, 'whatsapp');

    // Quitar del carrito lo que ya se registró o quedó en la cola; dejar lo que falló.
    items
      .filter(({ product }) => result.doneShopIds.includes(product.tienda_id))
      .forEach(({ product }) => removeItem(product.id));

    if (result.failed.length > 0) {
      setPaymentStatus('idle');
      showAppMessage(
        result.failed.map((failure) => `${failure.tienda}: ${userFacingError(failure.error, 'No se pudo registrar el pedido.')}`).join('\n'),
        result.created.length ? 'Algunos pedidos no se enviaron' : 'Pedido no enviado',
        'error',
      );
      if (result.created.length === 0) return;
    }

    if (result.created.length === 0 && result.queuedOffline.length > 0) {
      setPaymentStatus('idle');
      onClose();
      showAppMessage(
        `Estás sin conexión. ${result.queuedOffline.length === 1 ? 'Tu pedido quedó guardado' : `Tus ${result.queuedOffline.length} pedidos (uno por comercio) quedaron guardados`} en este dispositivo y se enviarán solos cuando vuelva internet. Después podrás mandar cada ticket por WhatsApp desde "Mis pedidos".`,
        'Pedido guardado sin conexión',
        'success',
      );
      return;
    }

    if (shopGroups.length === 1) setDeliveryEstimate(obtenerEstimacionEntrega());
    if (paymentMethod === 'en_linea') await new Promise((resolve) => window.setTimeout(resolve, 1200));

    // El envío por WhatsApp (imagen del ticket + enlaces de productos) se hace desde el ticket:
    // compartir una imagen requiere un clic del cliente. Con varios comercios, /pedidos/enviar
    // muestra un ticket y un botón de WhatsApp por cada uno.
    setCardNumber(''); setCardExpiration(''); setCardCvc('');
    setPaymentStatus('success');
    onClose();
    const path = afterCheckoutPath(result.created);
    if (path) window.location.assign(path);
  };

  const addComplement = (item: AIRecommendation) => {
    addItem({
      id: item.id,
      tienda_id: item.tienda_id,
      nombre: item.nombre,
      precio: item.precio,
      precio_gs: item.precio,
      precio_oferta: item.precio_oferta ?? null,
      imagen_url: item.imagen_url ?? undefined,
      activo: true,
      stock: null,
      stock_minimo: null,
      tienda_nombre: item.tienda_nombre,
      tienda_slug: item.tienda_slug,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Cabecera */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-emerald-700 text-white">
          <div>
            <h2 className="font-bold text-lg">Tu Carrito de Compras</h2>
            {shopGroups.length > 1
              ? <p className="text-xs text-emerald-200">{shopGroups.length} comercios · un pedido y un WhatsApp por cada uno</p>
              : shopGroups[0] && <p className="text-xs text-emerald-200">{shopGroups[0].tienda_nombre}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-600 rounded-lg text-xl font-bold">
            ✕
          </button>
        </div>

        {/* Lista de Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
              <span className="text-5xl mb-3">🛒</span>
              <p className="font-medium">Tu carrito está vacío</p>
              <p className="text-xs text-gray-400 mt-1">Explora las tiendas de Guairá y añade tus productos preferidos.</p>
            </div>
          ) : (
            shopGroups.map((group) => (
            <section key={group.tienda_id} aria-label={`Productos de ${group.tienda_nombre}`} className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                <h3 className="text-xs font-black uppercase tracking-wide text-gray-600">🏪 {group.tienda_nombre}</h3>
                <span className="text-xs font-bold text-emerald-700">Gs. {group.subtotal.toLocaleString('es-PY')}</span>
              </div>
            {group.items.map(({ product, cantidad }) => {
              const nombreProducto = product.nombre ?? product.titulo ?? 'Producto';
              return (
                <div key={product.id} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {product.imagen_url && (
                    <Image src={product.imagen_url} alt={nombreProducto} width={64} height={64} unoptimized className="w-16 h-16 object-cover rounded-lg" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-sm">{nombreProducto}</h4>
                    <div className="mt-0.5"><PriceTag price={product.precio_gs ?? product.precio} offer={product.precio_oferta} size="sm" className="text-emerald-700" hideBadge /></div>
                    
                    {/* Control de Cantidad */}
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => updateQuantity(product.id, cantidad - 1)}
                        className="w-6 h-6 bg-white border border-gray-300 rounded-md flex items-center justify-center text-xs font-bold"
                      >
                        -
                      </button>
                      <span className="text-xs font-semibold">{cantidad}</span>
                      <button
                        onClick={() => updateQuantity(product.id, cantidad + 1)}
                        disabled={cantidad >= getMaxQuantity(product.stock)}
                        title={cantidad >= getMaxQuantity(product.stock) ? 'No hay más unidades en stock' : undefined}
                        className="w-6 h-6 bg-white border border-gray-300 rounded-md flex items-center justify-center text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    {cantidad >= getMaxQuantity(product.stock) && (
                      <p className="mt-1 text-[10px] font-bold text-amber-700">Máximo disponible: {getMaxQuantity(product.stock)}</p>
                    )}
                  </div>

                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-bold p-1"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
            </section>
            ))
          )}

          {complements.length > 0 && (
            <section aria-label="Productos complementarios" className="rounded-xl border border-dashed border-emerald-400 bg-slate-50 p-3">
              <h3 className="text-xs font-black uppercase tracking-wide text-emerald-800">✨ Completa tu compra</h3>
              <ul className="mt-2 space-y-2">
                {complements.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-gray-800">{item.nombre}</span>
                      <span className="block truncate text-gray-500">{item.tienda_nombre} · {item.motivo}</span>
                    </span>
                    <button type="button" onClick={() => addComplement(item)} className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-bold text-white hover:bg-emerald-700">
                      + Gs. {(item.precio_oferta && item.precio_oferta < item.precio ? item.precio_oferta : item.precio).toLocaleString('es-PY')}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Pie de Carrito y Botón de WhatsApp */}
        {items.length > 0 && (
          <div className="p-5 border-t border-gray-100 bg-gray-50 space-y-4">
            <div className="space-y-3">
              <input
                type="text"
                required
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Nombre del cliente"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="text"
                required
                value={customerAddress}
                onChange={(event) => setCustomerAddress(event.target.value)}
                placeholder="Dirección de entrega"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-between items-center text-gray-800">
              <span className="font-medium text-sm">Total a pagar:</span>
              <span className="text-xl font-extrabold text-emerald-700">Gs. {totalAmount.toLocaleString('es-PY')}</span>
            </div>

            <Link
              href="/checkout"
              onClick={onClose}
              className="block w-full rounded-xl bg-primary-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-primary-800"
            >
              Continuar al checkout
            </Link>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">Método de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'Efectivo', label: '💵 Efectivo' },
                  { value: 'Transferencia Bancaria', label: '🏦 Transferencia' },
                  { value: 'en_linea', label: '💳 Compra en Línea (demo)' },
                ].map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                      paymentMethod === method.value
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-400'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'en_linea' && (
              <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-black">⚠️ Pago de demostración</p>
                  <p className="mt-1 leading-5">No se cobra nada ni se conecta con un banco. <strong>No escribas una tarjeta real.</strong> El pago verdadero se coordina con el comercio.</p>
                  <button
                    type="button"
                    onClick={() => { setCardNumber('4500 0000 0000 0000'); setCardExpiration('12/30'); setCardCvc('123'); }}
                    className="mt-2 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
                  >
                    Usar datos de prueba
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">Número de Tarjeta (de prueba)</label>
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(event) => setCardNumber(event.target.value)}
                    placeholder="4500 0000 0000 0000"
                    autoComplete="off"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">Expiración MM/AA</label>
                    <input
                      type="text"
                      required
                      value={cardExpiration}
                      onChange={(event) => setCardExpiration(event.target.value)}
                      placeholder="MM/AA"
                      autoComplete="off"
                      inputMode="numeric"
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">CVC</label>
                    <input
                      type="text"
                      required
                      value={cardCvc}
                      onChange={(event) => setCardCvc(event.target.value)}
                      placeholder="123"
                      autoComplete="off"
                      inputMode="numeric"
                      maxLength={4}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-emerald-800">
                  Modo prototipo: estos datos no se guardan ni se envían; quedan solo en esta pantalla.
                </p>
              </div>
            )}

            {paymentStatus === 'processing' && (
              <div className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-3 text-center text-xs font-bold text-primary-800">
                {paymentMethod === 'en_linea'
                  ? 'Registrando tu pedido y simulando el pago de prueba (no se cobra nada)...'
                  : 'Registrando tu pedido y generando el ticket...'}
              </div>
            )}

            {paymentStatus === 'success' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-xs font-bold text-emerald-800">
                {paymentMethod === 'en_linea' ? '✅ Pago simulado: no se cobró nada. El pago se coordina con el comercio.' : '✅ Pedido registrado.'} Entrega estimada: {deliveryEstimate}.
              </div>
            )}

            <button
              onClick={handleSendOrder}
              disabled={paymentStatus !== 'idle'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <span>{paymentMethod === 'en_linea' ? '💳 Continuar (pago de demostración)' : '🚀 Realizar Pedido por WhatsApp'}</span>
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 2c-5.514 0-9.999 4.486-9.999 10 0 1.763.457 3.42 1.258 4.869l-1.337 4.887 5.006-1.313c1.401.763 2.998 1.196 4.673 1.196 5.513 0 10.024-4.486 10.024-10s-4.511-10-10.025-10z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}