'use client';

/**
 * [PÁGINA] Página /checkout: confirmar el pedido (dirección, distrito, pago). Sin conexión, guarda el pedido en la cola offline.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/frontend/context/CartContext';
import { supabase } from '@/shared/supabase/client';
import { getMyOrder } from '@/frontend/services/orders.service';
import type { CheckoutConfirmation, CheckoutInput } from '@/shared/types/database';
import { afterCheckoutPath, submitOrdersByShop } from '@/frontend/lib/multi-store-checkout';
import { userFacingError } from '@/shared/lib/user-facing-error';
import OrderTicket from '@/frontend/components/orders/OrderTicket';
import type { OrderTicketData } from '@/frontend/lib/order-ticket';

import PriceTag from '@/frontend/components/products/PriceTag';
import { getPricing } from '@/shared/lib/product-pricing';

type CheckoutProduct = {
  id: string;
  tienda_id: string;
  titulo: string;
  nombre: string | null;
  descripcion: string | null;
  precio_gs: number;
  precio_oferta: number | null;
  disponible: boolean;
  /** Unidades disponibles; `null` = sin control de stock. */
  stock: number | null;
};

type CheckoutShop = { id: string; nombre_comercio: string };
type CheckoutDistrict = { id: number; nombre: string };

function priceFor(product: CheckoutProduct): number {
  return getPricing(product.precio_gs, product.precio_oferta).price;
}

export default function CheckoutPage() {
  const { items, removeItem, shopGroups } = useCart();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [products, setProducts] = useState<CheckoutProduct[]>([]);
  /** Comercios del carrito (multitienda: se crea un pedido por cada uno). */
  const [shops, setShops] = useState<CheckoutShop[]>([]);
  const [districts, setDistricts] = useState<CheckoutDistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CheckoutConfirmation['pedido'] | null>(null);
  const [ticket, setTicket] = useState<OrderTicketData | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);
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

      // getSession() usa la sesión guardada en el dispositivo: funciona sin conexión.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!active) return;
      setAuthenticated(Boolean(user));

      if (!user || items.length === 0) {
        setLoading(false);
        return;
      }

      const shopIds = Array.from(new Set(items.map(({ product }) => product.tienda_id)));

      const productIds = items.map(({ product }) => product.id);
      const [productsResult, shopResult, districtsResult] = await Promise.all([
        supabase
          .from('productos')
          .select('id, tienda_id, titulo, nombre, descripcion, precio_gs, precio_oferta, disponible, stock')
          .in('id', productIds),
        supabase
          .from('tiendas')
          .select('id, nombre_comercio')
          .in('id', shopIds)
          .eq('estado', 'activa'),
        supabase.from('distritos').select('id, nombre').eq('activo', true).order('nombre'),
      ]);

      if (!active) return;

      const loadError = productsResult.error || shopResult.error || districtsResult.error;
      if (loadError && !navigator.onLine) {
        // Sin conexión y sin copia guardada: usar los datos del carrito. El servidor
        // vuelve a validar precios y disponibilidad cuando el pedido se envíe.
        setOfflineMode(true);
        setProducts(items.map(({ product }) => ({
          id: product.id,
          tienda_id: product.tienda_id,
          titulo: product.titulo ?? product.nombre ?? 'Producto',
          nombre: product.nombre ?? null,
          descripcion: product.descripcion ?? null,
          precio_gs: Number(product.precio_gs ?? product.precio ?? 0),
          precio_oferta: product.precio_oferta ?? null,
          disponible: true,
          stock: null,
        })));
        setShops(shopIds.map((id) => ({
          id,
          nombre_comercio: items.find(({ product }) => product.tienda_id === id)?.product.tienda_nombre || 'Tienda',
        })));
        setDistricts((districtsResult.data || []) as CheckoutDistrict[]);
      } else if (loadError) {
        setError(userFacingError(loadError, 'No se pudo cargar la información del pedido. Inténtalo de nuevo.'));
      } else {
        setProducts((productsResult.data || []) as CheckoutProduct[]);
        const loadedShops = (shopResult.data || []) as CheckoutShop[];
        setShops(loadedShops);
        setDistricts((districtsResult.data || []) as CheckoutDistrict[]);

        const rows = productsResult.data || [];
        if (rows.length !== productIds.length) {
          setError('Uno o más productos ya no están disponibles. Actualiza el carrito antes de confirmar.');
        } else if (rows.some((product) => !product.disponible || product.tienda_id !== items.find((item) => item.product.id === product.id)?.product.tienda_id)) {
          setError('Un producto dejó de estar disponible o ya no pertenece a esta tienda.');
        } else if (rows.some((product) => product.stock != null && (items.find((item) => item.product.id === product.id)?.cantidad ?? 0) > product.stock)) {
          const short = rows.find((product) => product.stock != null && (items.find((item) => item.product.id === product.id)?.cantidad ?? 0) > product.stock);
          setError(`No hay stock suficiente de "${short?.titulo}": quedan ${short?.stock} unidades. Ajusta la cantidad en el carrito.`);
        } else if (loadedShops.length !== shopIds.length) {
          setError('Uno de los comercios del carrito ya no está disponible. Quita sus productos para continuar.');
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
      if (shops.length === 0 || productsUnavailable || lineItems.length !== items.length) {
        throw new Error('Actualiza el carrito: hay productos que no pueden incluirse en el pedido.');
      }

      // Multitienda: un pedido por comercio con los mismos datos de entrega y pago.
      const shopNames = new Map(shops.map((item) => [item.id, item.nombre_comercio]));
      const groups = shopGroups.map((group) => ({ ...group, tienda_nombre: shopNames.get(group.tienda_id) ?? group.tienda_nombre }));
      const result = await submitOrdersByShop(groups, {
        metodo_pago: paymentMethod,
        direccion_entrega: address,
        distrito_id: districtId ? Number(districtId) : null,
        latitud: location?.latitud ?? null,
        longitud: location?.longitud ?? null,
        notas: notes,
      }, 'checkout');

      items
        .filter(({ product }) => result.doneShopIds.includes(product.tienda_id))
        .forEach(({ product }) => removeItem(product.id));

      if (result.failed.length > 0) {
        setError(result.failed.map((failure) => `${failure.tienda}: ${userFacingError(failure.error, 'No se pudo registrar el pedido.')}`).join(' · '));
        if (result.created.length === 0 && result.queuedOffline.length === 0) return;
      }

      if (result.created.length === 0) {
        setQueuedOffline(true);
        return;
      }

      if (result.created.length > 1 || result.queuedOffline.length > 0) {
        // Varios comercios: un ticket y un WhatsApp por cada uno
        window.location.assign(afterCheckoutPath(result.created) ?? '/pedidos');
        return;
      }

      const order = await getMyOrder(result.created[0].id).catch(() => null);
      setCreatedOrder(order?.pedido ?? { id: result.created[0].id, numero_pedido: result.created[0].numero_pedido } as CheckoutConfirmation['pedido']);
      if (order) setTicket({ pedido: order.pedido, detalles: order.detalles });
    } catch (submitError) {
      setError(userFacingError(submitError, 'No se pudo confirmar el pedido. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (queuedOffline) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <section className="rounded-3xl border border-amber-200 bg-white px-6 py-10 text-center">
          <p className="text-4xl">📡</p>
          <p className="mt-3 text-sm font-bold uppercase text-amber-700">Pedido guardado sin conexión</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Se enviará cuando vuelva internet</h1>
          <p className="mt-3 text-slate-600">
            Tu pedido quedó guardado en este dispositivo. Al reconectar se envía solo y te avisamos con el número de ticket.
            El comercio confirmará precios y disponibilidad en ese momento.
          </p>
          <Link href="/pedidos" className="mt-6 inline-flex rounded-xl bg-primary-600 px-5 py-3 font-bold text-white hover:bg-primary-700">
            Ver mis pedidos
          </Link>
        </section>
      </main>
    );
  }

  if (createdOrder) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <section className="no-print border-y border-emerald-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-bold uppercase text-emerald-700">Pedido recibido</p>
          <h1 className="mt-2 break-all text-2xl font-black text-slate-900 sm:text-3xl">{createdOrder.numero_pedido}</h1>
          <p className="mt-3 text-slate-600">El pedido quedó registrado como pendiente. Guardá tu ticket.</p>
          <Link href={`/pedidos/${createdOrder.id}`} className="mt-6 inline-flex rounded-lg bg-primary-700 px-5 py-3 font-bold text-white hover:bg-primary-800">
            Ver pedido
          </Link>
        </section>
        <section className="mt-8">
          {ticket
            ? <OrderTicket pedido={ticket.pedido} detalles={ticket.detalles} />
            : <p className="text-center text-sm text-slate-500">Generando ticket…</p>}
        </section>
      </main>
    );
  }

  if (authenticated === false) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h1 className="text-2xl font-black text-slate-900">Inicia sesión para continuar</h1>
        <Link href="/auth/login" className="mt-5 inline-flex rounded-lg bg-primary-700 px-5 py-3 font-bold text-white">Iniciar sesión</Link>
      </main>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14 text-center">
        <h1 className="text-2xl font-black text-slate-900">Tu carrito está vacío</h1>
        <Link href="/tiendas" className="mt-5 inline-flex rounded-lg bg-primary-700 px-5 py-3 font-bold text-white">Explorar Productos</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-black uppercase text-primary-700">Checkout</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Confirmar pedido</h1>
        </div>
        <Link href="/tiendas" className="text-sm font-bold text-primary-700 hover:underline">Volver al catálogo</Link>
      </div>

      {error && <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Verificando productos y precios actuales...</p>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="space-y-8">
            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-900">Productos</h2>
              {shopGroups.length > 1 && (
                <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  Tu carrito tiene productos de {shopGroups.length} comercios: se creará un pedido para cada uno y podrás enviar cada pedido por WhatsApp a su comercio.
                </p>
              )}
              {shopGroups.map((group) => (
              <div key={group.tienda_id} className="mb-5">
              <p className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Comercio: <strong>{shops.find((item) => item.id === group.tienda_id)?.nombre_comercio ?? group.tienda_nombre}</strong></span>
                <span className="font-bold text-slate-800">Gs. {group.items.reduce((sum, { product, cantidad }) => sum + (productById.get(product.id) ? priceFor(productById.get(product.id)!) : 0) * cantidad, 0).toLocaleString('es-PY')}</span>
              </p>
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {group.items.map(({ product, cantidad }) => {
                  const current = productById.get(product.id);
                  const name = current?.nombre || current?.titulo || product.nombre;
                  const unit = current ? priceFor(current) : 0;
                  return (
                    <div key={product.id} className="flex items-start justify-between gap-4 py-4">
                      <div>
                        <p className="font-bold text-slate-900">{name}</p>
                        <p className="mt-1 text-sm text-slate-500">Cantidad: {cantidad}</p>
                        {current && <div className="mt-1"><PriceTag price={current.precio_gs} offer={current.precio_oferta} size="sm" className="text-slate-600" /></div>}
                        {current && !current.disponible && <p className="text-xs font-semibold text-rose-700">No disponible</p>}
                        {current?.stock != null && cantidad > current.stock && <p className="text-xs font-semibold text-rose-700">Solo quedan {current.stock} unidades</p>}
                      </div>
                      <p className="whitespace-nowrap text-sm font-bold text-slate-800">Gs. {(unit * cantidad).toLocaleString('es-PY')}</p>
                    </div>
                  );
                })}
              </div>
              </div>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Entrega y pago</h2>
              <label className="block text-sm font-semibold text-slate-700">
                Dirección de entrega
                <input required minLength={3} maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary-600" />
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
              <p className="text-xs text-slate-500">Opcional. Si la agregás, el punto de entrega se guarda en este pedido para que el comercio pueda encontrarte.</p>
              <label className="block text-sm font-semibold text-slate-700">
                Método de pago
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as CheckoutInput['metodo_pago'])} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal">
                  <option value="efectivo">Efectivo al recibir</option>
                  <option value="transferencia">Transferencia bancaria</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Notas para la tienda
                <textarea maxLength={1000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-primary-600" />
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
            <button type="submit" disabled={submitting || loading || productsUnavailable || shops.length === 0} className="mt-5 w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400">
              {submitting ? 'Confirmando...' : offlineMode ? 'Guardar pedido (sin conexión)' : 'Confirmar pedido'}
            </button>
            {offlineMode && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Sin conexión: se usan los precios guardados en tu carrito. El pedido se enviará al reconectar.
              </p>
            )}
          </aside>
        </form>
      )}
    </main>
  );
}