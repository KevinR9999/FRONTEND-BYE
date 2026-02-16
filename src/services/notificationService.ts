// src/services/notificationService.ts
import { supabase } from '../lib/supabaseClient';

export interface StudentNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  sent_at: string;
  created_at: string;
}

// Obtener todas las notificaciones enviadas con estado de lectura para el usuario
export async function getNotificationsForUser(userId: string): Promise<(StudentNotification & { is_read: boolean })[]> {
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('*')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  // Lecturas del usuario
  const { data: reads } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', userId);

  const readIds = new Set((reads || []).map((r: any) => r.notification_id));

  // Nivel del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('level')
    .eq('user_id', userId)
    .maybeSingle();

  const userLevel = profile?.level || null;

  // Para notificaciones target_mode='users', verificar si el usuario es destinatario
  const usersNotifs = (notifications || []).filter((n: any) => n.target_mode === 'users');
  const userRecipientIds = new Set<string>();

  if (usersNotifs.length > 0) {
    const { data: recipientRows } = await supabase
      .from('notification_recipients')
      .select('notification_id')
      .eq('user_id', userId)
      .in('notification_id', usersNotifs.map((n: any) => n.id));

    (recipientRows || []).forEach((r: any) => userRecipientIds.add(r.notification_id));
  }

  return (notifications || [])
    .filter((n: any) => {
      const mode = n.target_mode || 'all';
      if (mode === 'all') return true;
      if (mode === 'level') return n.target_level === null || n.target_level === userLevel;
      if (mode === 'users') return userRecipientIds.has(n.id);
      return true;
    })
    .map((n: any) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      sent_at: n.sent_at,
      created_at: n.created_at,
      is_read: readIds.has(n.id),
    }));
}

// Marcar una notificación como leída
export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { notification_id: notificationId, user_id: userId },
      { onConflict: 'notification_id,user_id' }
    );

  if (error) {
    console.error('Error marking notification as read:', error);
  }
}

// Marcar todas como leídas
export async function markAllAsRead(userId: string): Promise<void> {
  const notifications = await getNotificationsForUser(userId);
  const unread = notifications.filter((n) => !n.is_read);

  if (unread.length === 0) return;

  const rows = unread.map((n) => ({
    notification_id: n.id,
    user_id: userId,
  }));

  const { error } = await supabase
    .from('notification_reads')
    .upsert(rows, { onConflict: 'notification_id,user_id' });

  if (error) {
    console.error('Error marking all as read:', error);
  }
}
