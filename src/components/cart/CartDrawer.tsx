'use client';

import { useCart } from '@/context/CartContext';
import { Shop } from '@/types/shop';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentShop?: Shop | null;
}

export default function CartDrawer({ isOpen, onClose, currentShop }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, totalAmount, clearCart, generateWhatsAppLink } = useCart();

  if (!isOpen) return null;

  const handleSendOrder = () => {
    if (!currentShop?.whatsapp && !currentShop?.telefono) {
      alert('El comercio no tiene configurado un número de WhatsApp.');
      return;
    }

    const phone = currentShop.whatsapp || currentShop.telefono || '';
    const link = generateWhatsAppLink(phone, currentShop.nombre);
    
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
              const precioUnitario = product.precio_oferta || product.precio;
              return (
                <div key={product.id} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {product.imagen_url && (
                    <img src={product.imagen_url} alt={product.nombre} className="w-16 h-16 object-cover rounded-lg" />
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
            <div className="flex justify-between items-center text-gray-800">
              <span className="font-medium text-sm">Total a pagar:</span>
              <span className="text-xl font-extrabold text-emerald-700">Gs. {totalAmount.toLocaleString('es-PY')}</span>
            </div>

            <button
              onClick={handleSendOrder}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <span>Enviar Pedido por WhatsApp</span>
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