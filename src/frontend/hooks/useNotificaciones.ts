'use client';

/**
 * [FRONTEND] Hook de notificaciones: contador de no leídas en tiempo real (con respaldo cada 60 s si la pestaña está visible).
 */
import { useEffect, useState } from 'react';
import { getClientUser, supabase } from '@/shared/supabase/client';

export default function useNotificaciones() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [changeVersion, setChangeVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval: number | undefined;

    const loadUnreadCount = async (authenticatedUserId: string) => {
      const { count, error } = await supabase
        .from('notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', authenticatedUserId)
        .eq('leida', false);

      if (active && !error) setUnreadCount(count ?? 0);
    };

    const setup = async () => {
      const { data: { user }, error } = await getClientUser();
      if (!active) return;
      if (error || !user) {
        setUnreadCount(0);
        return;
      }

      userId = user.id;
      channel = supabase
        .channel(`notificaciones:${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${user.id}`,
        }, () => {
          setChangeVersion((version) => version + 1);
          if (userId) void loadUnreadCount(userId);
        })
        .subscribe();

      void loadUnreadCount(user.id);
      // Respaldo del canal realtime: solo con la pestaña visible.
      interval = window.setInterval(() => { if (document.visibilityState === 'visible') void loadUnreadCount(user.id); }, 60_000);
    };

    void setup();

    return () => {
      active = false;
      if (interval !== undefined) window.clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return { unreadCount, changeVersion };
}