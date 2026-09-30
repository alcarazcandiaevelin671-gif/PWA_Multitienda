import { supabase } from '@/lib/supabase';
import { getCurrentUser, isMissingTableError } from '@/services/orders.service';

export async function getMyNotifications() {
  try {
    const user = await getCurrentUser();
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }

    return data || [];
  } catch (error) {
    if (error instanceof Error && isMissingTableError(error)) return [];
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string) {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true, updated_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('usuario_id', user.id);

  if (error && !isMissingTableError(error)) {
    throw error;
  }
}

export async function getPendingNotificationsCount() {
  const notifications = await getMyNotifications();
  return notifications.filter((notification: any) => !notification.leida).length;
}
