// src/services/adminService.ts
import { supabase } from '../lib/supabaseClient';
import type {
  UserProfile,
  Lesson,
  LessonQuestion,
  DiagnosticQuestion,
  Notification,
  DashboardStats,
  Payment,
  Subscription,
  PaymentPlan,
  PaymentStats,
  Level
} from '../types/admin';

// ============ DASHBOARD ============
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const [
      usersResult,
      activeUsersResult,
      lessonsResult,
      diagnosticResult,
      completionsResult
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('lessons').select('*', { count: 'exact', head: true }),
      supabase.from('diagnostic_questions').select('id', { count: 'exact', head: true }),
      supabase.from('lesson_progress').select('*', { count: 'exact', head: true }).eq('completed', true)
    ]);

    console.log('📊 Dashboard stats:', {
      users: usersResult.count,
      activeUsers: activeUsersResult.count,
      lessons: lessonsResult.count,
      diagnosticQuestions: diagnosticResult.count,
      completions: completionsResult.count
    });

    return {
      totalUsers: usersResult.count || 0,
      activeUsers: activeUsersResult.count || 0,
      totalLessons: lessonsResult.count || 0,
      totalDiagnosticQuestions: diagnosticResult.count || 0,
      usersThisWeek: 0, // No hay created_at en profiles
      lessonCompletions: completionsResult.count || 0
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalLessons: 0,
      totalDiagnosticQuestions: 0,
      usersThisWeek: 0,
      lessonCompletions: 0
    };
  }
}

// ============ USUARIOS ============
export async function getUsers(): Promise<UserProfile[]> {
  console.log('📊 Fetching users from profiles table...');

  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  console.log('📊 Users query result:', { data, error, count: data?.length });

  if (error) {
    console.error('❌ Error fetching users:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn('⚠️ No users found in profiles table');
    return [];
  }

  console.log(`✅ Found ${data.length} users`);

  // Normalize data to ensure defaults
  return data.map(user => ({
    ...user,
    is_active: user.is_active ?? true,
    role: user.role || 'student',
    xp_total: user.xp_total || 0,
    streak_days: user.streak_days || 0,
    lessons_completed: user.lessons_completed || 0,
    diagnostic_completed: user.diagnostic_completed || false
  }));
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
  return data;
}

export async function updateUser(userId: string, updates: Partial<UserProfile>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('user_id', userId);

  if (error) {
    console.error('Error toggling user active status:', error);
    throw error;
  }
}

export async function setUserRole(userId: string, role: 'student' | 'admin'): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('user_id', userId);

  if (error) {
    console.error('Error setting user role:', error);
    throw error;
  }
}

// ============ NIVELES (dinámicos desde lessons) ============
export async function getLevels(): Promise<{ code: string; count: number }[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('level');

  if (error) {
    console.error('Error fetching levels:', error);
    throw error;
  }

  // Agrupar por nivel y contar lecciones
  const levelMap = new Map<string, number>();
  (data || []).forEach(lesson => {
    const level = lesson.level;
    if (level) {
      levelMap.set(level, (levelMap.get(level) || 0) + 1);
    }
  });

  // Convertir a array ordenado
  return Array.from(levelMap.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

// ============ LECCIONES ============
export async function getLessons(level?: Level): Promise<Lesson[]> {
  let query = supabase
    .from('lessons')
    .select('*')
    .order('level')
    .order('order_index');

  if (level) {
    query = query.eq('level', level);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching lessons:', error);
    throw error;
  }

  // Normalize data
  return (data || []).map(lesson => ({
    ...lesson,
    order_index: typeof lesson.order_index === 'string' ? parseInt(lesson.order_index, 10) : lesson.order_index,
    estimated_minutes: typeof lesson.estimated_minutes === 'string' ? parseInt(lesson.estimated_minutes, 10) : lesson.estimated_minutes,
    is_locked: lesson.is_locked === true || lesson.is_locked === 'true'
  }));
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (error) {
    console.error('Error fetching lesson:', error);
    throw error;
  }
  return data;
}

export async function createLesson(lesson: Omit<Lesson, 'id' | 'created_at'>): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .insert(lesson)
    .select()
    .single();

  if (error) {
    console.error('Error creating lesson:', error);
    throw error;
  }
  return data;
}

export async function updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update(updates)
    .eq('id', lessonId);

  if (error) {
    console.error('Error updating lesson:', error);
    throw error;
  }
}

export async function deleteLesson(lessonId: string): Promise<void> {
  // First delete related questions
  const { error: questionsError } = await supabase
    .from('lesson_questions')
    .delete()
    .eq('lesson_id', lessonId);

  if (questionsError) {
    console.error('Error deleting lesson questions:', questionsError);
    throw questionsError;
  }

  // Then delete the lesson
  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId);

  if (error) {
    console.error('Error deleting lesson:', error);
    throw error;
  }
}

// ============ PREGUNTAS DE LECCIÓN ============
export async function getLessonQuestions(lessonId: string): Promise<LessonQuestion[]> {
  const { data, error } = await supabase
    .from('lesson_questions')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index');

  if (error) {
    console.error('Error fetching lesson questions:', error);
    throw error;
  }

  // Normalize options field
  return (data || []).map(q => ({
    ...q,
    options: Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options) : null),
    correct_answers: Array.isArray(q.correct_answers) ? q.correct_answers : (q.correct_answers ? JSON.parse(q.correct_answers) : null)
  }));
}

export async function createLessonQuestion(question: Omit<LessonQuestion, 'id'>): Promise<LessonQuestion> {
  const { data, error } = await supabase
    .from('lesson_questions')
    .insert(question)
    .select()
    .single();

  if (error) {
    console.error('Error creating lesson question:', error);
    throw error;
  }
  return data;
}

export async function updateLessonQuestion(questionId: string, updates: Partial<LessonQuestion>): Promise<void> {
  const { error } = await supabase
    .from('lesson_questions')
    .update(updates)
    .eq('id', questionId);

  if (error) {
    console.error('Error updating lesson question:', error);
    throw error;
  }
}

export async function deleteLessonQuestion(questionId: string): Promise<void> {
  const { error } = await supabase
    .from('lesson_questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    console.error('Error deleting lesson question:', error);
    throw error;
  }
}

// ============ PREGUNTAS DIAGNÓSTICAS ============
export async function getDiagnosticQuestions(level?: Level): Promise<DiagnosticQuestion[]> {
  let query = supabase
    .from('diagnostic_questions')
    .select('*')
    .order('level')
    .order('id');

  if (level) {
    query = query.eq('level', level);
  }

  const { data, error } = await query;

  console.log('📊 Diagnostic questions raw count:', data?.length);

  if (error) {
    console.error('Error fetching diagnostic questions:', error);
    throw error;
  }

  // Eliminar duplicados por ID
  const uniqueQuestions = data ? Array.from(
    new Map(data.map(q => [q.id, q])).values()
  ) : [];

  console.log('📊 Diagnostic questions unique count:', uniqueQuestions.length);

  // Normalize options field
  return uniqueQuestions.map(q => ({
    ...q,
    options: Array.isArray(q.options) ? q.options : [],
    exercise_type: q.exercise_type || 'multiple_choice',
    skill: q.skill || 'reading'
  }));
}

export async function getDiagnosticQuestionById(questionId: string): Promise<DiagnosticQuestion | null> {
  const { data, error } = await supabase
    .from('diagnostic_questions')
    .select('*')
    .eq('id', questionId)
    .single();

  if (error) {
    console.error('Error fetching diagnostic question:', error);
    throw error;
  }
  return data;
}

export async function createDiagnosticQuestion(question: Omit<DiagnosticQuestion, 'id' | 'created_at'>): Promise<DiagnosticQuestion> {
  const { data, error } = await supabase
    .from('diagnostic_questions')
    .insert(question)
    .select()
    .single();

  if (error) {
    console.error('Error creating diagnostic question:', error);
    throw error;
  }
  return data;
}

export async function updateDiagnosticQuestion(questionId: string, updates: Partial<DiagnosticQuestion>): Promise<void> {
  const { error } = await supabase
    .from('diagnostic_questions')
    .update(updates)
    .eq('id', questionId);

  if (error) {
    console.error('Error updating diagnostic question:', error);
    throw error;
  }
}

export async function deleteDiagnosticQuestion(questionId: string): Promise<void> {
  const { error } = await supabase
    .from('diagnostic_questions')
    .delete()
    .eq('id', questionId);

  if (error) {
    console.error('Error deleting diagnostic question:', error);
    throw error;
  }
}

// ============ NOTIFICACIONES ============
export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
  return data || [];
}

export async function createNotification(notification: Omit<Notification, 'id' | 'created_at' | 'sent_at'>): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      ...notification,
      sent_at: null
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
  return data;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

export async function markNotificationAsSent(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as sent:', error);
    throw error;
  }
}

// ============ ACTUALIZAR ÚLTIMA CONEXIÓN ============
export async function updateLastSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ last_seen: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) console.error('Error updating last_seen:', error);
}

// ============ PAGOS Y SUSCRIPCIONES ============

// PAGOS
export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      profiles:user_id (
        email,
        full_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }

  // Normalize data to include user info
  return (data || []).map(payment => ({
    ...payment,
    user_email: payment.profiles?.email || '',
    user_name: payment.profiles?.full_name || 'Sin nombre'
  }));
}

export async function createPayment(payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert(payment)
    .select()
    .single();

  if (error) {
    console.error('Error creating payment:', error);
    throw error;
  }

  return data;
}

export async function updatePayment(paymentId: string, updates: Partial<Payment>): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .update(updates)
    .eq('id', paymentId);

  if (error) {
    console.error('Error updating payment:', error);
    throw error;
  }
}

export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', paymentId);

  if (error) {
    console.error('Error deleting payment:', error);
    throw error;
  }
}

// SUSCRIPCIONES
export async function getSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      profiles:user_id (
        email,
        full_name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching subscriptions:', error);
    throw error;
  }

  return (data || []).map(sub => ({
    ...sub,
    user_email: sub.profiles?.email || '',
    user_name: sub.profiles?.full_name || 'Sin nombre'
  }));
}

export async function createSubscription(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(subscription)
    .select()
    .single();

  if (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }

  return data;
}

export async function updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', subscriptionId);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

export async function deleteSubscription(subscriptionId: string): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', subscriptionId);

  if (error) {
    console.error('Error deleting subscription:', error);
    throw error;
  }
}

export async function getUserSubscriptions(userId: string): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false});

  if (error) {
    console.error('Error fetching user subscriptions:', error);
    throw error;
  }

  return data || [];
}

// PAYMENT PLANS
export async function getPaymentPlans(): Promise<PaymentPlan[]> {
  const { data, error } = await supabase
    .from('payment_plans')
    .select('*')
    .order('price', { ascending: true });

  if (error) {
    console.error('Error fetching payment plans:', error);
    throw error;
  }

  return (data || []).map(plan => ({
    ...plan,
    features: Array.isArray(plan.features) ? plan.features : (plan.features ? JSON.parse(plan.features) : [])
  }));
}

export async function getPaymentPlanById(planId: string): Promise<PaymentPlan | null> {
  const { data, error } = await supabase
    .from('payment_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) {
    console.error('Error fetching payment plan:', error);
    throw error;
  }

  return data;
}

export async function createPaymentPlan(plan: Omit<PaymentPlan, 'id' | 'created_at'>): Promise<PaymentPlan> {
  const { data, error } = await supabase
    .from('payment_plans')
    .insert(plan)
    .select()
    .single();

  if (error) {
    console.error('Error creating payment plan:', error);
    throw error;
  }

  return data;
}

export async function updatePaymentPlan(planId: string, updates: Partial<PaymentPlan>): Promise<void> {
  const { error } = await supabase
    .from('payment_plans')
    .update(updates)
    .eq('id', planId);

  if (error) {
    console.error('Error updating payment plan:', error);
    throw error;
  }
}

export async function deletePaymentPlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from('payment_plans')
    .delete()
    .eq('id', planId);

  if (error) {
    console.error('Error deleting payment plan:', error);
    throw error;
  }
}

// PAYMENT STATS
export async function getPaymentStats(): Promise<PaymentStats> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      revenueResult,
      activeSubsResult,
      expiringSoonResult,
      recentPaymentsResult
    ] = await Promise.all([
      // Total revenue from completed payments
      supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed'),

      // Active subscriptions
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),

      // Expiring soon (next 7 days)
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('end_date', now.toISOString())
        .lte('end_date', sevenDaysFromNow.toISOString()),

      // Recent payments (last 30 days)
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString())
    ]);

    const totalRevenue = revenueResult.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    return {
      totalRevenue,
      activeSubscriptions: activeSubsResult.count || 0,
      expiringSoon: expiringSoonResult.count || 0,
      recentPayments: recentPaymentsResult.count || 0
    };
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    return {
      totalRevenue: 0,
      activeSubscriptions: 0,
      expiringSoon: 0,
      recentPayments: 0
    };
  }
}
