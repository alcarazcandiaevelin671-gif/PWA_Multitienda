'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import useNotificaciones from '@/hooks/useNotificaciones';
import type { Notificacion } from '@/types/database';

const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];
  const unit = units.find(([, secondsPerUnit]) => Math.abs(seconds) >= secondsPerUnit);
  if (!unit) return 'Hace unos segundos';
  return relativeTime.format(Math.round(seconds / unit[1]), unit[0]);
}

function defaultNotificationPath(notification: Notificacion, role: string) {
  const type = notification.tipo.toLowerCase();
  if (role === 'comerciante') {
    if (['comercio_aprobado', 'comercio_rechazado'].includes(type)) return '/comerciante/tienda';
    if (type === 'nuevo_pedido') return '/comerciante/pedidos';
  }
  if (role === 'cliente') {
    if (type === 'estado_pedido') return '/pedidos';
    if (type === 'promocion') return '/tiendas';
  }
  return '/notificaciones';
}

type NotificationDestination = { kind: 'internal'; href: string } | { kind: 'external'; href: string };

function getNotificationDestination(notification: Notificacion, role: string): NotificationDestination {
  const link = notification.link?.trim();
  const destination = link || defaultNotificationPath(notification, role);
  if (destination.startsWith('/') && !destination.startsWith('//')) return { kind: 'internal', href: destination };
  try {
    const url = new URL(destination);
    if (url.protocol === 'http:' || url.protocol === 'https:') return { kind: 'external', href: url.toString() };
  } catch {
    return { kind: 'internal', href: defaultNotificationPath(notification, role) };
  }
  return { kind: 'internal', href: defaultNotificationPath(notification, role) };
}

export default function NotificationBell({ userId, role }: { userId: string; role: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const { unreadCount, changeVersion } = useNotificaciones();

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('notificaciones')
      .select('id, usuario_id, titulo, mensaje, tipo, leida, link, created_at')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (loadError) {
      setNotifications([]);
      setError('No se pudieron cargar tus notificaciones.');
      return;
    }

    setNotifications((data ?? []) as Notificacion[]);
    setError('');
  }, [userId]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (changeVersion > 0) void load();
  }, [changeVersion, load]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const handleSelect = async (notification: Notificacion) => {
    setMarkingId(notification.id);
    const { error: updateError } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', notification.id)
      .eq('usuario_id', userId);
    setMarkingId(null);
    if (updateError) {
      setError('No se pudo marcar la notificación como leída.');
      return;
    }
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, leida: true } : item));
    setOpen(false);
    const destination = getNotificationDestination(notification, role);
    if (destination.kind === 'external') window.location.assign(destination.href);
    else router.push(destination.href);
  };

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'} aria-expanded={open} aria-haspopup="menu" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && <div role="menu" aria-label="Notificaciones recientes" className="absolute right-0 top-[calc(100%+0.65rem)] z-[80] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-extrabold text-slate-900">Notificaciones</h2>
          {unreadCount > 0 && <span className="text-[11px] font-bold text-sky-700">{unreadCount} sin leer</span>}
        </div>
        {error && <p role="alert" className="px-4 py-3 text-xs text-rose-700">{error}</p>}
        {!error && notifications.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">No tienes notificaciones.</p>}
        {notifications.length > 0 && <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {notifications.map((notification) => <li key={notification.id}>
            <button type="button" role="menuitem" disabled={markingId === notification.id} onClick={() => void handleSelect(notification)} className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-60 ${notification.leida ? 'bg-white' : 'bg-sky-50/70'}`}>
              <span className="flex items-start gap-3">
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.leida ? 'bg-transparent' : 'bg-sky-600'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">{notification.titulo || notification.tipo || 'Notificación'}</span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600">{notification.mensaje}</span>
                  <span className="mt-1.5 block text-[10px] font-medium text-slate-400">{formatRelativeDate(notification.created_at)}</span>
                </span>
              </span>
            </button>
          </li>)}
        </ul>}
        <Link href="/notificaciones" onClick={() => setOpen(false)} role="menuitem" className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-bold text-sky-700 transition hover:bg-sky-50 hover:text-sky-900">Ver todas las notificaciones</Link>
      </div>}
    </div>
  );
}