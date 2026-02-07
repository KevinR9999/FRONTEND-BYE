// src/types/achievements.ts

export type AchievementCategory = 'lessons' | 'xp' | 'streak' | 'accuracy' | 'diagnostic' | 'levels' | 'social';

// Definición de un logro (tabla achievements)
export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  threshold: number;
  xp_reward: number;
}

// Logro desbloqueado por usuario (tabla user_achievements)
export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  seen: boolean;
}

// Logro con estado de desbloqueo (para UI)
export interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlocked_at?: string;
  seen?: boolean;
}

// Stats del usuario para verificar logros
export interface UserStatsForAchievements {
  xp_total: number;
  lessons_completed: number;
  streak_days: number;
  diagnostic_completed: boolean;
  friends_count: number;
  current_accuracy?: number;
  levels_completed?: {
    A1: boolean;
    A2: boolean;
    B1: boolean;
    B2: boolean;
  };
}
