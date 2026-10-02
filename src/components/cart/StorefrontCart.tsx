'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import CartDrawer from '@/components/cart/CartDrawer';
import FavoriteToggle from '@/components/common/FavoriteToggle';
import { Product } from '@/types/product';
import { getEffectiveProductPrice } from '@/lib/product-pricing';
import { supabase } from '@/lib/supabase';

interface StorefrontProduct {
  id: string;
  tienda_id: string;
  categoria_id?: number | string | null;
  titulo?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  precio_gs?: number | null;
  precio_oferta?: number | null;
  disponible?: boolean | null;
  imagen_url?: string | null;
}

interface StorefrontCartProps {
  products: StorefrontProduct[];
  categories?: { id: number | string; nombre: string }[];
  shop: {
    id: string;
    nombre: string;
    whatsapp?: string | null;
    telefono?: string | null;
  };
}

export default function StorefrontCart({ products, categories = [], shop }: StorefrontCartProps) {
  const { addItem, totalItems } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [filterTerm, setFilterTerm] = useState('');

  const categoryMap = new Map(
    categories.map((category) => [String(category.id), category.nombre])
  );

  const filteredProducts = products.filter((product) => {
    const normalizedTerm = filterTerm.trim();

    if (!normalizedTerm) return true;

    const haystack = [
      product.nombre || product.titulo || '',
      product.descripcion || '',
      categoryMap.get(String(product.categoria_id || '')) || '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedTerm.toLowerCase());
  });

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#product-')) return;

    const target = document.getElementById(hash.replace('#', ''));
    if (target) {
      window.setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus();
      }, 180);
    }
  }, []);

  const addProduct = (product: StorefrontProduct) => {
    const item: Product = {
      id: product.id,
      tienda_id: product.tienda_id,
      nombre: product.nombre || product.titulo || 'Producto',
      descripcion: product.descripcion || undefined,
      precio: Number(product.precio_gs || 0),
      precio_gs: Number(product.precio_gs || 0),
      precio_oferta: product.precio_oferta == null ? undefined : Number(product.precio_oferta),
      stock: 1,
      imagen_url: product.imagen_url || undefined,
      activo: true,
    };
    addItem(item);
    void supabase.rpc('registrar_interaccion_producto', {
      p_producto_id: product.id,
      p_tipo: 'click',
    });
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-xl transition hover:bg-emerald-700"
      >
        🛒 Carrito{totalItems > 0 ? ` (${totalItems})` : ''}
      </button>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Filtrar productos</p>
          <p className="text-sm text-slate-600">Busca por nombre o categoría dentro de esta tienda.</p>
        </div>
        <div className="relative w-full md:max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔎</span>
          <input
            type="text"
            value={filterTerm}
            onChange={(event) => setFilterTerm(event.target.value)}
            placeholder="Buscar producto o categoría"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white"
            aria-label="Buscar producto o categoría en esta tienda"
          />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <p className="text-lg font-bold text-slate-700">No hay productos que coincidan con tu búsqueda.</p>
          <p className="mt-2 text-sm text-slate-500">Prueba con otro nombre o categoría dentro de esta tienda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => {
            const name = product.nombre || product.titulo || 'Producto';
            const price = getEffectiveProductPrice({
              id: product.id,
              tienda_id: product.tienda_id,
              nombre: name,
              precio: Number(product.precio_gs || 0),
              precio_gs: Number(product.precio_gs || 0),
              precio_oferta: product.precio_oferta == null ? undefined : Number(product.precio_oferta),
              stock: 1,
              activo: product.disponible !== false,
            });
            return (
              <article
                id={`product-${product.id}`}
                key={product.id}
                tabIndex={-1}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none"
              >
                <div>
                  <div className="relative flex h-48 w-full items-center justify-center bg-slate-100">
                    <FavoriteToggle kind="producto" targetId={product.id} className="absolute right-3 top-3 z-10" />
                    {product.imagen_url ? (
                      <Image src={product.imagen_url} alt={name} fill unoptimized className="object-cover" />
                    ) : (
                      <span className="text-4xl text-slate-300">📦</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-1 text-base font-bold text-slate-900">{name}</h3>
                    {product.descripcion && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.descripcion}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 p-4">
                  <span className="text-base font-extrabold text-blue-600">{price.toLocaleString('es-PY')} Gs.</span>
                  <button
                    type="button"
                    onClick={() => addProduct(product)}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                  >
                    Agregar 🛒
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CartDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentShop={shop as any}
      />
    </>
  );
}
