import { supabase } from "../../../lib/supabaseClient";
import type { ThemeMode } from "./theme";

export type Language = "es" | "en";
export type ProfileVisibility = "public" | "friends" | "private";

export type UserSettings = {
  user_id: string;
  theme: ThemeMode;
  language: Language;
  sound_enabled: boolean;
  notifications_enabled: boolean;
  daily_goal_minutes: number;
  profile_visibility: ProfileVisibility;
  allow_friend_requests: boolean;
  daily_reminder_enabled: boolean;
  reminder_time: string; // "19:00:00"
  timezone: string; // "America/Bogota"
  notify_streak_alert: boolean;
  notify_new_lessons: boolean;
  notify_achievements: boolean;
  notify_friends_activity: boolean;

};

export const DEFAULT_SETTINGS: Omit<UserSettings, "user_id"> = {
  theme: "system",
  language: "es",
  sound_enabled: true,
  notifications_enabled: true,
  daily_goal_minutes: 10,
  profile_visibility: "friends",
  allow_friend_requests: true,
  daily_reminder_enabled: true,
  reminder_time: "19:00:00",
  timezone: "America/Bogota",
  notify_streak_alert: true,
  notify_new_lessons: false,
  notify_achievements: true,
  notify_friends_activity: false,

};

export async function getMySettings(userId: string) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as UserSettings | null;
}

export async function upsertMySettings(settings: UserSettings) {
  const { data, error } = await supabase
    .from("user_settings")
    .upsert(settings, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as UserSettings;
}

export async function ensureMySettings(userId: string) {
  const existing = await getMySettings(userId);
  if (existing) return existing;

  return await upsertMySettings({
    user_id: userId,
    ...DEFAULT_SETTINGS,
  });
}
