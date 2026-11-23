/**
 * [FRONTEND] Notificaciones: listar, marcar como leídas y contar no leídas.
 */
import { supabase } from '@/shared/supabase/client';
import { getCurrentUser, isMissingTableError } from '@/frontend/services/orders.service';
import type { Notificacion } from '@/shared/types/database';

export async function getMyNotifications(): Promise<Notificacion[]> {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('notificaciones')
      .select('id, usuario_id, titulo, mensaje, tipo, leida, link, created_at')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return (data || []) as Notificacion[];
  } catch (error) {
    if (error instanceof Error && isMissingTableError(error)) return [];
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string) {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', notificationId)
    .eq('usuario_id', user.id);

  if (error && !isMissingTableError(error)) {
    throw error;
  }
}

export async function markAllMyNotificationsAsRead() {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('usuario_id', user.id)
    .eq('leida', false);

  if (error && !isMissingTableError(error)) throw error;
}

export async function getPendingNotificationsCount() {
  const notifications = await getMyNotifications();
  return notifications.filter((notification: any) => !notification.leida).length;
}
