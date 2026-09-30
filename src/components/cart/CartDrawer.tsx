'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { Shop } from '@/types/shop';
import { supabase } from '@/lib/supabase';
import { showAppMessage } from '@/lib/app-message';
import { getEffectiveProductPrice } from '@/lib/product-pricing';
import Image from 'next/image';
import Link from 'next/link';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentShop?: Shop | null;
}

export default function CartDrawer({ isOpen, onClose, currentShop }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, totalAmount, clearCart, generateWhatsAppLink } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiration, setCardExpiration] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [deliveryEstimate, setDeliveryEstimate] = useState('30 a 45 minutos');

  if (!isOpen) return null;

  const obtenerEstimacionEntrega = (): Promise<string> => new Promise((resolve) => {
    if (!navigator.geolocation || currentShop?.latitud == null || currentShop?.longitud == null) {
      resolve('30 a 45 minutos');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const toRadians = (value: number) => (value * Math.PI) / 180;
        const deltaLat = toRadians(currentShop.latitud! - position.coords.latitude);
        const deltaLng = toRadians(currentShop.longitud! - position.coords.longitude);
        const a = Math.sin(deltaLat / 2) ** 2
          + Math.cos(toRadians(position.coords.latitude))
          * Math.cos(toRadians(currentShop.latitud!))
          * Math.sin(deltaLng / 2) ** 2;
        const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        resolve(distanceKm > 10 ? '60 a 90 minutos' : distanceKm > 5 ? '45 a 60 minutos' : '30 a 45 minutos');
      },
      () => resolve('30 a 45 minutos'),
      { timeout: 4000 },
    );
  });

  const handleSendOrder = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      showAppMessage('Debes iniciar sesión para completar tu compra.', 'Inicio de sesión requerido', 'error');
      window.location.href = '/auth/login';
      return;
    }

    if (!currentShop?.whatsapp && !currentShop?.telefono) {
      showAppMessage('El comercio no tiene configurado un número de WhatsApp.', 'Compra no disponible', 'error');
      return;
    }

    const phone = currentShop.whatsapp || currentShop.telefono || '';
    const selectedPaymentMethod = paymentMethod === 'en_linea'
      ? 'Compra en Línea (Tarjeta)'
      : paymentMethod;
    if (!customerName.trim() || !customerAddress.trim()) {
      showAppMessage('Completa tu nombre y dirección de entrega.', 'Datos incompletos', 'error');
      return;
    }

    if (paymentMethod === 'en_linea' && (!cardNumber || !cardExpiration || !cardCvc)) {
      showAppMessage('Completa los datos de la tarjeta para continuar.', 'Pago no válido', 'error');
      return;
    }

    const estimate = await obtenerEstimacionEntrega();
    setDeliveryEstimate(estimate);
    const link = generateWhatsAppLink(
      phone,
      currentShop.nombre,
      selectedPaymentMethod,
      customerName,
      customerAddress,
    );

    if (paymentMethod === 'en_linea') {
      setPaymentStatus('processing');
      window.setTimeout(() => {
        setPaymentStatus('success');
        window.open(link, '_blank');
      }, 1200);
      return;
    }
    
    // Redirigir a WhatsApp y limpiar carrito
    window.open(link, '_blank');
    clearCart();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Cabecera */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-emerald-700 text-white">
          <div>
            <h2 className="font-bold text-lg">Tu Carrito de Compras</h2>
            {currentShop && <p className="text-xs text-emerald-200">{currentShop.nombre}</p>}
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
            items.map(({ product, cantidad }) => {
              const precioUnitario = getEffectiveProductPrice(product);
              return (
                <div key={product.id} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {product.imagen_url && (
                    <Image src={product.imagen_url} alt={product.nombre} width={64} height={64} unoptimized className="w-16 h-16 object-cover rounded-lg" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-sm">{product.nombre}</h4>
                    <p className="text-xs font-bold text-emerald-700">Gs. {precioUnitario.toLocaleString('es-PY')}</p>
                    
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
                        className="w-6 h-6 bg-white border border-gray-300 rounded-md flex items-center justify-center text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(product.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-bold p-1"
                  >
                    🗑️
                  </button>
                </div>
              );
            })
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
              className="block w-full rounded-xl bg-blue-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-blue-800"
            >
              Continuar al checkout
            </Link>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">Método de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'Efectivo', label: '💵 Efectivo' },
                  { value: 'Transferencia Bancaria', label: '🏦 Transferencia' },
                  { value: 'en_linea', label: '💳 Compra en Línea' },
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
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">Número de Tarjeta</label>
                  <input
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(event) => setCardNumber(event.target.value)}
                    placeholder="4500 0000 0000 0000"
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
                      inputMode="numeric"
                      maxLength={4}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-emerald-800">
                  Modo prototipo: los datos de tarjeta se validan localmente y nunca se envían por WhatsApp.
                </p>
              </div>
            )}

            {paymentStatus === 'processing' && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-center text-xs font-bold text-blue-800">
                Conectando con Bancard y procesando el pago de prueba...
              </div>
            )}

            {paymentStatus === 'success' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-xs font-bold text-emerald-800">
                ✅ Pago simulado realizado con éxito. Entrega estimada: {deliveryEstimate}.
              </div>
            )}

            <button
              onClick={handleSendOrder}
              disabled={paymentStatus !== 'idle'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <span>{paymentMethod === 'en_linea' ? '💳 Continuar con compra en línea' : '🚀 Realizar Pedido por WhatsApp'}</span>
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