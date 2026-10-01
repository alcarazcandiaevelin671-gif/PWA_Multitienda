'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { markAllMyNotificationsAsRead, markNotificationAsRead } from '@/services/notifications.service';
import { userFacingError } from '@/lib/user-facing-error';
import type { Notificacion } from '@/types/database';

const PAGE_SIZE = 25;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function safeNotificationLink(link: string | null | undefined) {
  return link?.startsWith('/') && !link.startsWith('//') ? link : null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [filterUnread, setFilterUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError) setError(userFacingError(authError, 'No se pudo validar la sesión.'));
      setUserId(user?.id ?? null);
      setAuthChecked(true);
    };
    void loadUser();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authChecked || !userId) {
      setLoading(false);
      return;
    }

    let active = true;
    const loadNotifications = async () => {
      setLoading(true);
      setError('');
      let query = supabase
        .from('notificaciones')
        .select('id, usuario_id, titulo, mensaje, tipo, leida, link, created_at', { count: 'exact' })
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (filterUnread) query = query.eq('leida', false);

      const [pageResult, unreadResult] = await Promise.all([
        query,
        supabase.from('notificaciones').select('id', { count: 'exact', head: true }).eq('usuario_id', userId).eq('leida', false),
      ]);
      if (!active) return;
      if (pageResult.error || unreadResult.error) {
        setNotifications([]);
        setTotal(0);
        setUnreadCount(0);
        setError(userFacingError(pageResult.error || unreadResult.error, 'No se pudieron cargar tus notificaciones.'));
      } else {
        setNotifications((pageResult.data ?? []) as Notificacion[]);
        setTotal(pageResult.count ?? 0);
        setUnreadCount(unreadResult.count ?? 0);
      }
      setLoading(false);
    };

    void loadNotifications();
    const channel = supabase
      .channel(`notificaciones-page:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${userId}`,
      }, () => { void loadNotifications(); })
      .subscribe();
    const interval = window.setInterval(() => { void loadNotifications(); }, 30_000);

    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [authChecked, filterUnread, page, refreshKey, userId]);

  const changeFilter = (unread: boolean) => {
    setFilterUnread(unread);
    setPage(1);
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    setError('');
    setNotice('');
    try {
      await markAllMyNotificationsAsRead();
      setNotice('Todas tus notificaciones se marcaron como leídas.');
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(userFacingError(cause, 'No se pudieron marcar las notificaciones.'));
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async (notification: Notificacion) => {
    setError('');
    if (!notification.leida) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, leida: true } : item));
        setRefreshKey((value) => value + 1);
      } catch (cause) {
        setError(userFacingError(cause, 'No se pudo marcar la notificación como leída.'));
        return;
      }
    }
    const link = safeNotificationLink(notification.link);
    if (link) router.push(link);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Tu cuenta</p>
            <h1 className="mt-1 text-3xl font-black text-slate-900">Notificaciones</h1>
            <p className="mt-2 text-sm text-slate-600">Avisos relacionados con tu cuenta y actividad en el portal.</p>
          </div>
          {userId && <button type="button" onClick={() => void markAllAsRead()} disabled={markingAll || unreadCount === 0} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-sky-300 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-50">{markingAll ? 'Marcando…' : 'Marcar todas como leídas'}</button>}
        </header>

        {!authChecked && <p role="status" className="py-10 text-center text-sm text-slate-500">Verificando tu sesión…</p>}
        {authChecked && !userId && <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-center">
          <p className="font-bold text-slate-800">Inicia sesión para ver tus notificaciones.</p>
          <Link href="/auth/login" className="mt-4 inline-flex rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-800">Iniciar sesión</Link>
        </div>}

        {userId && <>
          <div className="mt-5 flex gap-2" role="group" aria-label="Filtrar notificaciones">
            <button type="button" aria-pressed={!filterUnread} onClick={() => changeFilter(false)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${!filterUnread ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>Todas</button>
            <button type="button" aria-pressed={filterUnread} onClick={() => changeFilter(true)} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${filterUnread ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>No leídas</button>
          </div>

          {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
          {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

          <section aria-label="Historial de notificaciones" className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {loading ? <p role="status" className="px-4 py-12 text-center text-sm text-slate-500">Cargando notificaciones…</p>
              : notifications.length === 0 ? <div className="px-4 py-14 text-center"><p className="font-semibold text-slate-700">{filterUnread ? 'No tienes notificaciones sin leer.' : 'Todavía no tienes notificaciones.'}</p></div>
                : <ul className="divide-y divide-slate-100">{notifications.map((notification) => <li key={notification.id}>
                  <button type="button" onClick={() => void openNotification(notification)} className={`flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5 ${notification.leida ? '' : 'bg-sky-50/60'}`}>
                    <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${notification.leida ? 'bg-slate-200' : 'bg-sky-600'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="font-bold text-slate-900">{notification.titulo || notification.tipo || 'Notificación'}</span>
                        <time className="text-[11px] text-slate-400">{formatDate(notification.created_at)}</time>
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap text-sm leading-6 text-slate-600">{notification.mensaje}</span>
                      {!notification.leida && <span className="mt-2 block text-[10px] font-black uppercase tracking-wide text-sky-700">No leída</span>}
                    </span>
                  </button>
                </li>)}</ul>}
            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>{total ? `${((page - 1) * PAGE_SIZE + 1).toLocaleString('es-PY')}–${Math.min(page * PAGE_SIZE, total).toLocaleString('es-PY')} de ${total.toLocaleString('es-PY')}` : '0 notificaciones'}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40">Anterior</button>
                <span>{page}/{totalPages}</span>
                <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="rounded-md border border-slate-200 px-2.5 py-1.5 font-semibold disabled:opacity-40">Siguiente</button>
              </div>
            </footer>
          </section>
        </>}
      </div>
    </main>
  );
}