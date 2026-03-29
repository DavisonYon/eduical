import { supabase } from './supabase'

/** Get canonical user order for conversation (smaller id first) to avoid duplicates */
export function getConversationUserIds(user1Id: string, user2Id: string): [string, string] {
  return [user1Id, user2Id].sort() as [string, string]
}

/** Check if two users are friends */
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const [u1, u2] = getConversationUserIds(userId1, userId2)
  const { data } = await supabase
    .from('friendships')
    .select('id')
    .or(`and(requester_id.eq.${u1},addressee_id.eq.${u2}),and(requester_id.eq.${u2},addressee_id.eq.${u1})`)
    .eq('status', 'accepted')
    .maybeSingle()
  return !!data
}


/** Check if current user has blocked the other user */
export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle()
  return !!data
}

/** Get or create a conversation between two users */
export async function getOrCreateConversation(
  currentUserId: string,
  otherUserId: string,
  areFriends: boolean
): Promise<{ id: string; status: string } | null> {
  const [u1, u2] = getConversationUserIds(currentUserId, otherUserId)

  const { data: existing } = await supabase
    .from('conversations')
    .select('id, status')
    .eq('user1_id', u1)
    .eq('user2_id', u2)
    .maybeSingle()

  if (existing) return existing

  const status = areFriends ? 'active' : 'request_pending'
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      user1_id: u1,
      user2_id: u2,
      status,
    })
    .select('id, status')
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    return null
  }
  return created
}
