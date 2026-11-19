'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '@/types/product';
import { CartItem } from '@/types/cart';
import { showAppConfirm } from '@/lib/app-message';
import { getEffectiveProductPrice } from '@/lib/product-pricing';
import { shortOrderNumber } from '@/lib/order-ticket';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, cantidad?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, cantidad: number) => void;
  clearCart: () => void;
  totalAmount: number;
  totalItems: number;
  generateWhatsAppLink: (
    merchantPhone: string,
    merchantName: string,
    paymentMethod?: string,
    customerName?: string,
    customerAddress?: string,
    order?: { id: string; numero: string },
  ) => string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    const savedCart = localStorage.getItem('pwa_multitienda_cart');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error cargando el carrito:', e);
      }
    }
  }, []);

  // Guardar en localStorage ante cualquier cambio
  useEffect(() => {
    localStorage.setItem('pwa_multitienda_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product: Product, cantidad: number = 1) => {
    setItems((prevItems) => {
      // Validar si es de la misma tienda
      if (prevItems.length > 0 && prevItems[0].product.tienda_id !== product.tienda_id) {
        void showAppConfirm('Tu carrito contiene productos de otra tienda. ¿Deseas vaciar el carrito para agregar productos de esta nueva tienda?').then((confirmed) => {
          if (confirmed) {
            setItems([{ product, cantidad }]);
          }
        });
        return prevItems;
      }

      const existingIndex = prevItems.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prevItems];
        updated[existingIndex].cantidad += cantidad;
        return updated;
      }
      return [...prevItems, { product, cantidad }];
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, cantidad: number) => {
    if (cantidad <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, cantidad } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + getEffectiveProductPrice(item.product) * item.cantidad,
    0
  );

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  /**
   * Estructura la orden según Ley N.° 4017/10 de Mensajes de Datos
   */
  const generateWhatsAppLink = (
    merchantPhone: string,
    merchantName: string,
    paymentMethod = 'Efectivo',
    customerName = 'Cliente',
    customerAddress = 'No especificada',
    order?: { id: string; numero: string },
  ) => {
    // Formatear el número de teléfono para Paraguay (ej: 0981123456 -> 595981123456)
    let cleanPhone = merchantPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '595' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('595')) {
      cleanPhone = '595' + cleanPhone;
    }

    // Solo símbolos del plano básico Unicode: los emojis de 4 bytes se corrompen ("�")
    // en WhatsApp Web/Desktop al abrir enlaces wa.me.
    const gs = (value: number) => `Gs. ${value.toLocaleString('es-PY')}`;
    const separator = '━━━━━━━━━━━━━━━━━━';
    const lines: string[] = [
      `✦ *NUEVO PEDIDO · ${merchantName.toUpperCase()}* ✦`,
    ];
    if (order) lines.push(`*Ticket:* \`${shortOrderNumber(order.numero)}\``);
    lines.push(
      separator,
      `*Cliente:* ${customerName}`,
      `*Entrega:* ${customerAddress}`,
      `*Pago:* ${paymentMethod}`,
      separator,
      '*DETALLE*',
    );

    items.forEach((item) => {
      const precioUnitario = getEffectiveProductPrice(item.product);
      const nombreProducto = item.product.nombre ?? item.product.titulo ?? 'Producto';
      lines.push(
        `▸ ${item.cantidad} × ${nombreProducto}`,
        `   ${gs(precioUnitario)} c/u  →  *${gs(precioUnitario * item.cantidad)}*`,
      );
    });

    lines.push(
      separator,
      `*TOTAL A PAGAR: ${gs(totalAmount)}*`,
      separator,
    );
    if (order) {
      lines.push(
        '✔ El pedido ya está registrado como *pendiente* en tu panel.',
        `Ver pedido: ${window.location.origin}/vendedor/pedidos/${order.id}`,
      );
    }
    lines.push('_Enviado desde el Portal Multitienda Guairá_');

    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(lines.join('\n'))}`;
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalAmount,
        totalItems,
        generateWhatsAppLink,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe ser usado dentro de un CartProvider');
  return context;
};