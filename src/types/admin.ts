// src/types/admin.ts

export type Level = string;
export type UserRole = 'student' | 'admin';

// Usuarios - matches profiles table
export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  level: Level | null;
  xp_total: number;
  streak_days: number;
  lessons_completed: number;
  diagnostic_completed: boolean;
  is_active: boolean;
  last_seen: string | null;
  avatar_url: string | null;
  created_at?: string;
}

// Lecciones - matches lessons table
export interface Lesson {
  id: string;
  level: Level;
  title: string;
  order_index: number;
  estimated_minutes: number;
  is_locked: boolean;
  created_at?: string;
}

// Preguntas de lección - matches lesson_questions table
export interface LessonQuestion {
  id: string;
  lesson_id: string;
  type: 'mcq' | 'fill-in' | 'word-order' | 'match';
  skill: 'grammar' | 'vocabulary' | 'reading' | 'listening' | 'writing' | 'speaking';
  prompt: string;
  options: string[] | null;
  correct_index: number | null;
  correct_answers: string[] | null;
  explanation: string | null;
  order_index: number;
  listen_text: string | null;
  audio_bucket: string | null;
  audio_path: string | null;
}

// Preguntas Diagnósticas - matches diagnostic_questions table
export interface DiagnosticQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  exercise_type: 'multiple_choice' | 'listening' | 'speaking' | 'fill_blank' | 'word_order' | 'reading';
  skill: string;
  level: Level;
  audio_text: string | null;
  image_url: string | null;
  order_index?: number;
  created_at?: string;
}

// Notificaciones - matches notifications table
export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'general' | 'reminder' | 'new_content' | 'promo';
  target_level: Level | null;
  created_by: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

// Estadísticas del Dashboard
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalLessons: number;
  totalDiagnosticQuestions: number;
  usersThisWeek: number;
  lessonCompletions: number;
}

// Configuración de la App
export interface AppSettings {
  id: string;
  key: string;
  value: string;
  description: string | null;
}

// Pagos - matches payments table
export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  plan_type: string;
  transaction_id: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields from profiles
  user_email?: string;
  user_name?: string;
}

// Suscripciones - matches subscriptions table
export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields from profiles
  user_email?: string;
  user_name?: string;
}

// Planes de pago - matches payment_plans table
export interface PaymentPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_days: number;
  features: string[];
  is_active: boolean;
  created_at: string;
}

// Para el dashboard
export interface PaymentStats {
  totalRevenue: number;
  activeSubscriptions: number;
  expiringSoon: number; // Expiran en los próximos 7 días
  recentPayments: number; // Últimos 30 días
}
