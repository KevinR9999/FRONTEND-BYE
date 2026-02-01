// src/services/chatService.ts
import { supabase } from "../lib/supabaseClient";
import type { ConversationRow, MessageRow } from "../types/social";
import { getMyUserId } from "./friendsService";

/**
 * Crea o retorna la conversación DM usando RPC (backend),
 * y asegura que ambos queden como miembros.
 */
export async function getOrCreateDmConversation(
  friendId: string
): Promise<ConversationRow> {
  // fuerza a que exista sesión (evita edge cases)
  await getMyUserId();

  const { data, error } = await supabase.rpc("create_dm_conversation", {
    p_friend_id: friendId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("No se pudo crear/obtener la conversación DM.");

  return row as ConversationRow;
}

/**
 * Carga mensajes de una conversación (orden ascendente por created_at).
 * Requiere policy SELECT en messages para miembros.
 */
export async function loadMessages(
  conversationId: string,
  limit = 50
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

/**
 * Envía un mensaje.
 * Requiere policy INSERT en messages: sender_id = auth.uid() y que sea miembro.
 */
export async function sendMessage(
  conversationId: string,
  body: string
): Promise<MessageRow> {
  const me = await getMyUserId();
  const text = body.trim();
  if (!text) throw new Error("Mensaje vacío");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: me,
      body: text,
    })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();

  if (error) throw error;
  return data as MessageRow;
}

/**
 * Suscripción realtime a mensajes nuevos (opcional).
 */
export function subscribeToMessages(
  conversationId: string,
  onNewMessage: (msg: MessageRow) => void
) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const msg = payload.new as MessageRow;
        onNewMessage(msg);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
