// src/services/friendsService.ts
import { supabase } from "../lib/supabaseClient";
import type { FriendshipRow, ProfileStats, PublicProfile } from "../types/social";
import { orderedPair } from "./socialHelpers";

export async function getMyUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("No authenticated user");
  return data.user.id;
}

export async function searchUsers(query: string, limit = 20): Promise<PublicProfile[]> {
  const me = await getMyUserId();

  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, level")
    .neq("user_id", me)
    .ilike("full_name", `%${q}%`)
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

export async function getProfilesByIds(ids: string[]): Promise<PublicProfile[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, level")
    .in("user_id", ids);

  if (error) throw error;
  return (data ?? []) as PublicProfile[];
}

export async function getMyFriendships(): Promise<FriendshipRow[]> {
  const me = await getMyUserId();
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`user1.eq.${me},user2.eq.${me}`);

  if (error) throw error;
  return (data ?? []) as FriendshipRow[];
}

export async function sendFriendRequest(otherUserId: string) {
  const me = await getMyUserId();
  const { user1, user2 } = orderedPair(me, otherUserId);

  const { error } = await supabase.from("friendships").insert({
    user1,
    user2,
    requested_by: me,
    status: "pending",
  });

  if (error) throw error;
}

// ✅ Cambiado: ahora verifica que sí se actualizó algo
export async function acceptFriendRequest(friendshipId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .select("id"); // <- esto nos permite saber si actualizó

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error(
      "No se pudo aceptar: 0 filas actualizadas (probable RLS/policy de UPDATE)."
    );
  }
}

// ✅ Cambiado: ahora verifica que sí se actualizó algo
export async function declineFriendRequest(friendshipId: string) {
  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error(
      "No se pudo rechazar: 0 filas actualizadas (probable RLS/policy de UPDATE)."
    );
  }
}

export async function getProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, avatar_url, level")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as PublicProfile | null;
}

export async function getStats(userId: string): Promise<ProfileStats | null> {
  const { data, error } = await supabase
    .from("profile_stats")
    .select("user_id, xp_total, streak, lessons_completed, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return null;
  return (data ?? null) as ProfileStats | null;
}
