'use client';

/**
 * [FRONTEND] Modo offline: registra el service worker, aviso "Sin conexión", envío de la cola de pedidos y limpieza de datos privados al cerrar sesión.
 */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/shared/supabase/client';
import { showAppMessage } from '@/frontend/lib/app-message';
import { createOrder } from '@/frontend/services/orders.service';
import { shortOrderNumber } from '@/frontend/lib/order-ticket';
import {
  OFFLINE_ORDERS_EVENT,
  flushQueuedOrders,
  getQueuedOrders,
} from '@/frontend/lib/offline-orders';

// Páginas que se descargan al instalar para que abran sin conexión aunque no se hayan visitado.
const WARM_UP_PUBLIC = ['/', '/tiendas', '/categorias', '/offline'];
const WARM_UP_PRIVATE = ['/pedidos', '/favoritos', '/notificaciones', '/perfil'];

// En desarrollo el service worker interfiere con la recarga en caliente de Next:
// se activa en producción, o en desarrollo con NEXT_PUBLIC_ENABLE_SW=true.
const SW_ENABLED = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === 'true';

function postToServiceWorker(message: Record<string, unknown>) {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage(message));
}

export default function PwaProvider() {
  const [online, setOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const lastUserId = useRef<string | null | undefined>(undefined);

  // 1) Registrar el service worker -------------------------------------------
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (!SW_ENABLED) {
      // Quitar un service worker de producción que haya quedado registrado en localhost.
      void navigator.serviceWorker.getRegistrations().then((list) => list.forEach((reg) => void reg.unregister()));
      return;
    }
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(() => postToServiceWorker({ type: 'WARM_UP', urls: WARM_UP_PUBLIC }))
      .catch((error) => console.error('No se pudo registrar el service worker:', error));
  }, []);

  // 2) Estado de conexión + cola de pedidos ----------------------------------
  useEffect(() => {
    const refreshPending = () => setPendingCount(getQueuedOrders().filter((order) => order.estado === 'pendiente').length);

    const flush = async () => {
      if (!navigator.onLine || getQueuedOrders().every((order) => order.estado !== 'pendiente')) return;
      const { enviados, rechazados } = await flushQueuedOrders(createOrder);
      if (enviados.length > 0) {
        const numeros = enviados.map(({ confirmacion }) => shortOrderNumber(confirmacion.pedido.numero_pedido)).join(', ');
        const viaWhatsApp = enviados.some(({ queued }) => queued.origen === 'whatsapp');
        showAppMessage(
          `Se enviaron ${enviados.length === 1 ? 'tu pedido guardado' : `${enviados.length} pedidos guardados`} sin conexión: ${numeros}.`
            + (viaWhatsApp ? ' Abrí "Mis pedidos" → Ticket para enviarlo por WhatsApp al comercio.' : ''),
          'Pedidos sincronizados',
          'success',
        );
      }
      if (rechazados.length > 0) {
        showAppMessage(
          `${rechazados.length === 1 ? 'Un pedido guardado no pudo enviarse' : `${rechazados.length} pedidos guardados no pudieron enviarse`}: ${rechazados[0].error}. Revisalo en "Mis pedidos".`,
          'Pedido no enviado',
          'error',
        );
      }
    };

    const handleOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      window.setTimeout(() => setJustReconnected(false), 4000);
      // Pequeña espera para que Supabase renueve la sesión antes de reenviar.
      window.setTimeout(() => void flush(), 2000);
    };
    const handleOffline = () => setOnline(false);

    setOnline(navigator.onLine);
    refreshPending();
    if (navigator.onLine) window.setTimeout(() => void flush(), 3000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_ORDERS_EVENT, refreshPending);
    window.addEventListener('storage', refreshPending);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_ORDERS_EVENT, refreshPending);
      window.removeEventListener('storage', refreshPending);
    };
  }, []);

  // 3) Datos privados: borrar al cerrar sesión / cambiar de usuario; precargar al iniciar sesión
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user.id ?? null;
      if (userId === lastUserId.current) return;
      const previous = lastUserId.current;
      lastUserId.current = userId;
      if (previous !== undefined) postToServiceWorker({ type: 'CLEAR_PRIVATE' });
      if (userId && SW_ENABLED && navigator.onLine) {
        window.setTimeout(() => postToServiceWorker({ type: 'WARM_UP', urls: WARM_UP_PRIVATE }), 1500);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (online && !justReconnected && pendingCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`no-print fixed inset-x-0 bottom-0 z-[90] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-xs font-bold text-white shadow-lg sm:text-sm ${
        !online ? 'bg-slate-800' : justReconnected ? 'bg-emerald-600' : 'bg-amber-600'
      }`}
    >
      {!online && <span>📡 Sin conexión · Estás viendo la información guardada en tu dispositivo.</span>}
      {online && justReconnected && <span>✅ Conexión restablecida.</span>}
      {pendingCount > 0 && (
        <Link href="/pedidos" className="underline underline-offset-2">
          {pendingCount === 1 ? '1 pedido pendiente de envío' : `${pendingCount} pedidos pendientes de envío`}
          {online ? ' · enviando…' : ' · se enviará al reconectar'}
        </Link>
      )}
    </div>
  );
}
