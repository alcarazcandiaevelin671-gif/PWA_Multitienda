'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { createOrder } from '@/services/orders.service';
import type { CheckoutConfirmation, CheckoutInput } from '@/types/database';
import { userFacingError } from '@/lib/user-facing-error';

type CheckoutProduct = {
  id: string;
  tienda_id: string;
  titulo: string;
  nombre: string | null;
  descripcion: string | null;
  precio_gs: number;
  precio_oferta: number | null;
  disponible: boolean;
};

type CheckoutShop = { id: string; nombre_comercio: string };
type CheckoutDistrict = { id: number; nombre: string };

function priceFor(product: CheckoutProduct): number {
  const base = Number(product.precio_gs);
  const offer = Number(product.precio_oferta);
  return Number.isFinite(offer) && offer > 0 && offer < base ? offer : base;
}

export default function CheckoutPage() {
  const { items, clearCart } = useCart();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [products, setProducts] = useState<CheckoutProduct[]>([]);
  const [shop, setShop] = useState<CheckoutShop | null>(null);
  const [districts, setDistricts] = useState<CheckoutDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CheckoutConfirmation['pedido'] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutInput['metodo_pago']>('efectivo');
  const [address, setAddress] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{ latitud: number; longitud: number } | null>(null);

  useEffect(() => {
    let active = true;

    const loadCheckoutData = async () => {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      setAuthenticated(Boolean(user));

      if (!user || items.length === 0) {
        setLoading(false);
        return;
      }

      const shopIds = Array.from(new Set(items.map(({ product }) => product.tienda_id)));
      if (shopIds.length !== 1) {
        setError('El carrito contiene productos de más de una tienda. Finaliza un pedido por tienda.');
        setLoading(false);
        return;
      }

      const productIds = items.map(({ product }) => product.id);
      const [productsResult, shopResult, districtsResult] = await Promise.all([
        supabase
          .from('productos')
          .select('id, tienda_id, titulo, nombre, descripcion, precio_gs, precio_oferta, disponible')
          .in('id', productIds),
        supabase
          .from('tiendas')
          .select('id, nombre_comercio')
          .eq('id', shopIds[0])
          .maybeSingle(),
        supabase.from('distritos').select('id, nombre').eq('activo', true).order('nombre'),
      ]);

      if (!active) return;

      const loadError = productsResult.error || shopResult.error || districtsResult.error;
      if (loadError) {
        setError(userFacingError(loadError, 'No se pudo cargar la información del pedido. Inténtalo de nuevo.'));
      } else {
        setProducts((productsResult.data || []) as CheckoutProduct[]);
        setShop((shopResult.data || null) as CheckoutShop | null);
        setDistricts((districtsResult.data || []) as CheckoutDistrict[]);

        const rows = productsResult.data || [];
        if (rows.length !== productIds.length) {
          setError('Uno o más productos ya no están disponibles. Actualiza el carrito antes de confirmar.');
        } else if (rows.some((product) => !product.disponible || product.tienda_id !== shopIds[0])) {
          setError('Un producto dejó de estar disponible o ya no pertenece a esta tienda.');
        } else if (!shopResult.data) {
          setError('La tienda asociada al carrito ya no está disponible.');
        }
      }

      setLoading(false);
    };

    void loadCheckoutData();
    return () => { active = false; };
  }, [items]);

  const productById = new Map(products.map((product) => [product.id, product]));
  const lineItems = items.flatMap(({ product, cantidad }) => {
    const current = productById.get(product.id);
    return current ? [{ product: current, cantidad, effectivePrice: priceFor(current) }] : [];
  });
  const subtotal = lineItems.reduce((sum, item) => sum + Number(item.product.precio_gs) * item.cantidad, 0);
  const discount = lineItems.reduce(
    (sum, item) => sum + (Number(item.product.precio_gs) - item.effectivePrice) * item.cantidad,
    0
  );
  const shipping = 0;
  const total = subtotal - discount + shipping;
  const productsUnavailable = lineItems.length !== items.length || lineItems.some(({ product }) => !product.disponible);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Este navegador no permite obtener la ubicación. Puedes continuar sin ella.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitud: coords.latitude, longitud: coords.longitude });
        setError(null);
      },
      () => setError('No se pudo obtener la ubicación. Puedes continuar sin ella.'),
      { timeout: 8000 }
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!shop || productsUnavailable || lineItems.length !== items.length) {
        throw new Error('Actualiza el carrito: hay productos que no pueden incluirse en el pedido.');
      }

      const result = await createOrder({
        tienda_id: shop.id,
        items: items.map(({ product, cantidad }) => ({ producto_id: product.id, cantidad })),
        metodo_pago: paymentMethod,
        direccion_entrega: address,
        distrito_id: districtId ? Number(districtId) : null,
        latitud: location?.latitud ?? null,
        longitud: location?.longitud ?? null,
        notas: notes,
      });

      setCreatedOrder(result.pedido);
      clearCart();
    } catch (submitError) {
      setError(userFacingError(submitError, 'No se pudo confirmar el pedido. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (createdOrder) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <section className="border-y border-emerald-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold uppercase text-emerald-700">Pedido recibido</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">{createdOrder.numero_pedido}</h1>
          <p className="mt-3 text-slate-600">El pedido quedó registrado como pendiente.</p>
          <Link href={`/pedidos/${createdOrder.id}`} className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800">
            Ver pedido
          </Link>
        </section>
      </main>
    );
  }

  if (authenticated === false) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h1 className="text-2xl font-black text-slate-900">Inicia sesión para continuar</h1>
        <Link href="/auth/login" className="mt-5 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-bold text-white">Iniciar sesión</Link>
      </main>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h1 className="text-2xl font-black text-slate-900">Tu carrito está vacío</h1>
        <Link href="/tiendas" className="mt-5 inline-flex rounded-lg bg-blue-700 px-5 py-3 font-bold text-white">Explorar tiendas</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase text-blue-700">Checkout</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Confirmar pedido</h1>
        </div>
        <Link href="/tiendas" className="text-sm font-bold text-blue-700 hover:underline">Volver al catálogo</Link>
      </div>

      {error && <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Verificando productos y precios actuales...</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-900">Productos</h2>
              {shop && <p className="mb-3 text-sm text-slate-600">Tienda: <strong>{shop.nombre_comercio}</strong></p>}
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {items.map(({ product, cantidad }) => {
                  const current = productById.get(product.id);
                  const name = current?.nombre || current?.titulo || product.nombre;
                  const unit = current ? priceFor(current) : 0;
                  return (
                    <div key={product.id} className="flex items-start justify-between gap-4 py-4">
                      <div>
                        <p className="font-bold text-slate-900">{name}</p>
                        <p className="mt-1 text-sm text-slate-500">Cantidad: {cantidad}</p>
                        {current && !current.disponible && <p className="text-xs font-semibold text-rose-700">No disponible</p>}
                      </div>
                      <p className="whitespace-nowrap text-sm font-bold text-slate-800">Gs. {(unit * cantidad).toLocaleString('es-PY')}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Entrega y pago</h2>
              <label className="block text-sm font-semibold text-slate-700">
                Dirección de entrega
                <input required minLength={3} maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Distrito
                <select value={districtId} onChange={(event) => setDistrictId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="">Seleccionar distrito (opcional)</option>
                  {districts.map((district) => <option key={district.id} value={district.id}>{district.nombre}</option>)}
                </select>
              </label>
              <button type="button" onClick={requestLocation} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {location ? 'Ubicación agregada' : 'Usar ubicación actual'}
              </button>
              <label className="block text-sm font-semibold text-slate-700">
                Método de pago
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as CheckoutInput['metodo_pago'])} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="efectivo">Efectivo al recibir</option>
                  <option value="transferencia">Transferencia bancaria</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Notas para la tienda
                <textarea maxLength={1000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600" />
              </label>
            </section>
          </div>

          <aside className="h-fit border-y border-slate-200 py-5 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold text-slate-900">Resumen</h2>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span>Gs. {subtotal.toLocaleString('es-PY')}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Descuento</span><span>- Gs. {discount.toLocaleString('es-PY')}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Envío</span><span>Gs. {shipping.toLocaleString('es-PY')}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-4 text-base font-black"><span>Total</span><span>Gs. {total.toLocaleString('es-PY')}</span></div>
            </div>
            <p className="mt-4 text-xs text-slate-500">El servidor volverá a validar disponibilidad y precios antes de registrar el pedido.</p>
            <button type="submit" disabled={submitting || loading || productsUnavailable || !shop} className="mt-5 w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {submitting ? 'Confirmando...' : 'Confirmar pedido'}
            </button>
          </aside>
        </form>
      )}
    </main>
  );
}