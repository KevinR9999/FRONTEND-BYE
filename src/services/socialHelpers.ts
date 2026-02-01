export function orderedPair(a: string, b: string) {
  return a < b ? { user1: a, user2: b } : { user1: b, user2: a };
}

export function pairKey(a: string, b: string) {
  const { user1, user2 } = orderedPair(a, b);
  return `${user1}:${user2}`;
}

export function otherUserIdFromFriendship(
  me: string,
  f: { user1: string; user2: string }
) {
  return f.user1 === me ? f.user2 : f.user1;
}
