export type FriendshipStatus = "pending" | "accepted" | "declined" | "blocked";

export type PublicProfile = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  level: string | null;
};

export type ProfileStats = {
  user_id: string;
  xp_total: number;
  streak: number;
  lessons_completed: number;
  updated_at: string;
};

export type FriendshipRow = {
  id: string;
  user1: string;
  user2: string;
  requested_by: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

export type ConversationRow = {
  id: string;
  kind: "dm" | "group";
  dm_key: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
