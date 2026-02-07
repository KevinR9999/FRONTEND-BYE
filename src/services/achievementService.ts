// src/services/achievementService.ts

import { supabase } from "../lib/supabaseClient";
import type {
  Achievement,
  UserAchievement,
  AchievementWithStatus,
  UserStatsForAchievements
} from "../types/achievements";

export const achievementService = {
  // Obtener todas las definiciones de logros
  async getAllAchievements(): Promise<Achievement[]> {
    const { data, error } = await supabase
      .from("achievements")
      .select("*")
      .order("category", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Obtener logros desbloqueados del usuario
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const { data, error } = await supabase
      .from("user_achievements")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return data || [];
  },

  // Obtener todos los logros con estado (desbloqueado o no)
  async getAchievementsWithStatus(userId: string): Promise<AchievementWithStatus[]> {
    const [achievements, userAchievements] = await Promise.all([
      this.getAllAchievements(),
      this.getUserAchievements(userId)
    ]);

    const unlockedMap = new Map(
      userAchievements.map(ua => [ua.achievement_id, ua])
    );

    return achievements.map(ach => {
      const userAch = unlockedMap.get(ach.id);
      return {
        ...ach,
        unlocked: !!userAch,
        unlocked_at: userAch?.unlocked_at,
        seen: userAch?.seen
      };
    });
  },

  // Desbloquear un logro
  async unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
    const { error } = await supabase
      .from("user_achievements")
      .insert({
        user_id: userId,
        achievement_id: achievementId,
        unlocked_at: new Date().toISOString(),
        seen: false
      });

    // Si ya existe (unique constraint), no es error
    if (error && error.code !== "23505") {
      console.error("Error unlocking achievement:", error);
      return false;
    }
    return true;
  },

  // Marcar logros como vistos
  async markAsSeen(userId: string): Promise<void> {
    const { error } = await supabase
      .from("user_achievements")
      .update({ seen: true })
      .eq("user_id", userId)
      .eq("seen", false);

    if (error) console.error("Error marking achievements as seen:", error);
  },

  // Obtener logros no vistos (para notificaciones)
  async getUnseenAchievements(userId: string): Promise<AchievementWithStatus[]> {
    const { data, error } = await supabase
      .from("user_achievements")
      .select(`
        *,
        achievements (*)
      `)
      .eq("user_id", userId)
      .eq("seen", false);

    if (error) throw error;

    return (data || []).map(ua => ({
      ...ua.achievements,
      unlocked: true,
      unlocked_at: ua.unlocked_at,
      seen: ua.seen
    }));
  },

  // Contar amigos del usuario
  async getFriendsCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("friendships")
      .select("*", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error) return 0;
    return count || 0;
  },

  // Actualizar racha del usuario
  async updateStreak(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Obtener perfil actual
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("streak_days, last_activity_date")
      .eq("user_id", userId)
      .single();

    if (error || !profile) return 0;

    const lastActivity = profile.last_activity_date;
    let newStreak = profile.streak_days || 0;

    if (!lastActivity) {
      // Primera actividad
      newStreak = 1;
    } else if (lastActivity === today) {
      // Ya practicó hoy, no cambiar nada
      return newStreak;
    } else {
      // Calcular diferencia de días
      const lastDate = new Date(lastActivity);
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Día consecutivo
        newStreak = newStreak + 1;
      } else if (diffDays > 1) {
        // Se rompió la racha
        newStreak = 1;
      }
    }

    // Actualizar perfil
    await supabase
      .from("profiles")
      .update({
        streak_days: newStreak,
        last_activity_date: today
      })
      .eq("user_id", userId);

    return newStreak;
  },

  // Verificar y desbloquear logros según stats actuales
  async checkAndUnlockAchievements(
    userId: string,
    stats: UserStatsForAchievements,
    currentAccuracy?: number
  ): Promise<Achievement[]> {
    const [achievements, userAchievements] = await Promise.all([
      this.getAllAchievements(),
      this.getUserAchievements(userId)
    ]);

    const unlockedIds = new Set(userAchievements.map(ua => ua.achievement_id));
    const newlyUnlocked: Achievement[] = [];

    for (const ach of achievements) {
      // Si ya lo tiene, saltar
      if (unlockedIds.has(ach.id)) continue;

      let shouldUnlock = false;

      switch (ach.category) {
        case "lessons":
          shouldUnlock = stats.lessons_completed >= ach.threshold;
          break;

        case "xp":
          shouldUnlock = stats.xp_total >= ach.threshold;
          break;

        case "streak":
          shouldUnlock = stats.streak_days >= ach.threshold;
          break;

        case "accuracy":
          if (currentAccuracy !== undefined) {
            shouldUnlock = currentAccuracy >= ach.threshold;
          }
          break;

        case "diagnostic":
          shouldUnlock = stats.diagnostic_completed;
          break;

        case "social":
          shouldUnlock = stats.friends_count >= ach.threshold;
          break;

        case "levels":
          if (stats.levels_completed) {
            if (ach.code === "level_a1") shouldUnlock = stats.levels_completed.A1;
            if (ach.code === "level_a2") shouldUnlock = stats.levels_completed.A2;
            if (ach.code === "level_b1") shouldUnlock = stats.levels_completed.B1;
            if (ach.code === "level_b2") shouldUnlock = stats.levels_completed.B2;
          }
          break;
      }

      if (shouldUnlock) {
        const success = await this.unlockAchievement(userId, ach.id);
        if (success) {
          newlyUnlocked.push(ach);

          // Si el logro da XP bonus, sumarlo
          if (ach.xp_reward > 0) {
            await supabase
              .from("profiles")
              .update({ xp_total: stats.xp_total + ach.xp_reward })
              .eq("user_id", userId);
          }
        }
      }
    }

    return newlyUnlocked;
  }
};
