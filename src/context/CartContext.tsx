'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '@/types/product';
import { CartItem } from '@/types/cart';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, cantidad?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, cantidad: number) => void;
  clearCart: () => void;
  totalAmount: number;
  totalItems: number;
  generateWhatsAppLink: (merchantPhone: string, merchantName: string) => string;
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
      // Validar si es de la misma tienda (opcional: limpiar si es de otra tienda)
      if (prevItems.length > 0 && prevItems[0].product.tienda_id !== product.tienda_id) {
        if (!confirm('Tu carrito contiene productos de otra tienda. ¿Deseas vaciar el carrito para agregar productos de esta nueva tienda?')) {
          return prevItems;
        }
        return [{ product, cantidad }];
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
    (sum, item) => sum + (item.product.precio_oferta || item.product.precio) * item.cantidad,
    0
  );

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);

  /**
   * Estructura la orden según Ley N.° 4017/10 de Mensajes de Datos
   */
  const generateWhatsAppLink = (merchantPhone: string, merchantName: string) => {
    // Formatear el número de teléfono para Paraguay (ej: 0981123456 -> 595981123456)
    let cleanPhone = merchantPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '595' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('595')) {
      cleanPhone = '595' + cleanPhone;
    }

    let message = `🛒 *NUEVO PEDIDO - ${merchantName.toUpperCase()}*\n`;
    message += `-----------------------------------\n\n`;

    items.forEach((item, index) => {
      const precioUnitario = item.product.precio_oferta || item.product.precio;
      const subtotal = precioUnitario * item.cantidad;
      message += `${index + 1}. *${item.product.nombre}*\n`;
      message += `   • Cantidad: ${item.cantidad}\n`;
      message += `   • Precio: Gs. ${precioUnitario.toLocaleString('es-PY')}\n`;
      message += `   • Subtotal: Gs. ${subtotal.toLocaleString('es-PY')}\n\n`;
    });

    message += `-----------------------------------\n`;
    message += `💰 *TOTAL A PAGAR: Gs. ${totalAmount.toLocaleString('es-PY')}*\n\n`;
    message += `📍 _Pedido generado desde el Portal Multitienda Guairá_`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
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