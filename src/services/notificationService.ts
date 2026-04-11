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

// Auto-enviar notificaciones programadas que ya vencieron
async function autoSendOverdueNotifications(): Promise<void> {
  try {
    const { data: overdue } = await supabase
      .from('notifications')
      .select('id')
      .is('sent_at', null)
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', new Date().toISOString());

    if (overdue && overdue.length > 0) {
      const now = new Date().toISOString();
      await Promise.all(
        overdue.map((n: any) =>
          supabase.from('notifications').update({ sent_at: now }).eq('id', n.id)
        )
      );
    }
  } catch (err) {
    // Silencioso - no bloquear la carga si falla
    console.error('Error auto-sending overdue notifications:', err);
  }
}

// Obtener todas las notificaciones enviadas con estado de lectura para el usuario
export async function getNotificationsForUser(userId: string): Promise<(StudentNotification & { is_read: boolean })[]> {
  // Primero enviar cualquier notificación programada que ya venció
  await autoSendOverdueNotifications();

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

  // Nivel y fecha de registro del usuario
  const { data: profile } = await supabase
    .from('profiles')
    .select('level, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  const userLevel = profile?.level || null;

  // Fecha de registro: primero del perfil, luego del auth (fallback para usuarios nuevos sin perfil)
  let userCreatedAt: string | null = profile?.created_at || null;
  if (!userCreatedAt) {
    const { data: authData } = await supabase.auth.getUser();
    userCreatedAt = authData?.user?.created_at || null;
  }

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

  const filtered = (notifications || [])
    .filter((n: any) => {
      // No mostrar notificaciones enviadas antes de que el usuario se registrara
      if (userCreatedAt && n.sent_at && new Date(n.sent_at) < new Date(userCreatedAt)) {
        return false;
      }
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

  // Mostrar primero las no leídas (más recientes primero), luego las leídas (más recientes primero)
  return filtered.sort((a, b) => {
    if (a.is_read !== b.is_read) return a.is_read ? 1 : -1;
    return new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime();
  });
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
