'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Notificacion } from '@/types/database';

const HISTORY_LIMIT = 25;

function safeNotificationLink(link: string | null) {
  if (!link) return null;
  if (link.startsWith('/') && !link.startsWith('//')) return link;

  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function loadNotificationHistory(userId: string) {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, usuario_id, tipo, titulo, mensaje, link, leida, created_at')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) return [] as Notificacion[];
  return (data ?? []) as Notificacion[];
}

export default function RealtimeNotificationListener() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [toast, setToast] = useState<Notificacion | null>(null);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    let active = true;
    let currentUserId: string | null = null;
    let syncVersion = 0;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const syncUser = async (nextUserId: string | null) => {
      if (currentUserId === nextUserId) return;
      currentUserId = nextUserId;
      const version = ++syncVersion;

      if (channel) {
        const previousChannel = channel;
        channel = null;
        await supabase.removeChannel(previousChannel);
      }

      if (!active || version !== syncVersion) return;
      setUserId(nextUserId);
      setNotifications([]);
      setToast(null);
      if (!nextUserId) return;

      const history = await loadNotificationHistory(nextUserId);
      if (!active || version !== syncVersion) return;
      setNotifications(history);

      channel = supabase
        .channel(`notificaciones-live:${nextUserId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${nextUserId}`,
        }, (payload) => {
          const notification = payload.new as Notificacion;
          if (!active || notification.usuario_id !== nextUserId) return;

          setNotifications((current) => [
            notification,
            ...current.filter((item) => item.id !== notification.id),
          ].slice(0, HISTORY_LIMIT));
          setToast(notification);
        })
        .subscribe();
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user?.id ?? null);
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (active && !error) void syncUser(data.user?.id ?? null);
    });

    return () => {
      active = false;
      syncVersion += 1;
      authListener.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 8_000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const openToast = async () => {
    if (!toast || !userId || markingRead) return;
    setMarkingRead(true);
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', toast.id)
      .eq('usuario_id', userId);
    setMarkingRead(false);
    if (error) return;

    setNotifications((current) => current.map((item) => item.id === toast.id ? { ...item, leida: true } : item));
    setToast(null);

    const destination = safeNotificationLink(toast.link);
    if (!destination) return;
    if (destination.startsWith('/')) router.push(destination);
    else window.location.assign(destination);
  };

  if (!toast) return null;

  return (
    <aside aria-live="polite" aria-atomic="true" className="fixed bottom-4 right-4 z-[140] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-start gap-3 p-4">
        <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{toast.titulo || toast.tipo || 'Nueva notificación'}</p>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-slate-600">{toast.mensaje}</p>
          <button type="button" onClick={() => void openToast()} disabled={markingRead} className="mt-3 text-xs font-bold text-sky-700 hover:text-sky-900 disabled:opacity-50">{markingRead ? 'Procesando…' : toast.link ? 'Abrir notificación' : 'Marcar como leída'}</button>
        </div>
        <button type="button" onClick={() => setToast(null)} aria-label="Cerrar aviso" className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">×</button>
      </div>
    </aside>
  );
}