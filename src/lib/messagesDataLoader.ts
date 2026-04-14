import { supabase } from './supabase'
import type { BlockedPreview, Conversation, Message, MessageRequest } from './messagesTypes'

export type { BlockedPreview, Conversation, Message, MessageRequest, Profile } from './messagesTypes'

function otherUserId(conv: { user1_id: string; user2_id: string }, userId: string): string {
  return conv.user1_id === userId ? conv.user2_id : conv.user1_id
}

export function computeSidebarListFingerprint(
  userId: string,
  blocks: { blocked_id: string }[],
  convs: { id: string; updated_at: string; status: string; user1_id: string; user2_id: string }[]
): string {
  const blockedSet = new Set((blocks ?? []).map((b) => b.blocked_id))
  const blockPart = [...blockedSet].sort().join(',')
  const filtered = (convs ?? []).filter((c) => {
    const other = otherUserId(c, userId)
    return !blockedSet.has(other)
  })
  const convPart = filtered
    .slice()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 50)
    .map((c) => `${c.id}:${c.updated_at}:${c.status}`)
    .join('|')
  return `${blockPart}::${convPart}`
}

/** Two small queries: blocks + conversation meta (same shape as full load uses for change detection). */
export async function fetchSidebarListFingerprint(userId: string): Promise<string> {
  const { data: blocks } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId)

  const { data: convs } = await supabase
    .from('conversations')
    .select('id, updated_at, status, user1_id, user2_id')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .in('status', ['active', 'request_pending'])

  return computeSidebarListFingerprint(userId, blocks ?? [], convs ?? [])
}

export async function fetchLatestMessageIdForConversation(conversationId: string): Promise<string | null> {
  const { data } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

export async function loadThreadMessages(conversationId: string): Promise<{
  messages: Message[]
  tailMessageId: string | null
}> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  const msgList = (data || []) as Message[]
  const senderIds = [...new Set(msgList.map((m) => m.sender_id))]
  const { data: senders } = await supabase
    .from('profiles')
    .select('id, full_name, email, profile_picture')
    .in('id', senderIds)

  const withSenders = msgList.map((m) => ({
    ...m,
    sender: senders?.find((s) => s.id === m.sender_id),
  }))

  const tail = msgList.length ? msgList[msgList.length - 1] : null
  return { messages: withSenders, tailMessageId: tail?.id ?? null }
}

export async function loadSidebarMessagesData(userId: string): Promise<{
  conversations: Conversation[]
  messageRequests: MessageRequest[]
  blockedMessages: BlockedPreview[]
  listFingerprint: string
}> {
  const { data: blocks } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId)
  const blockedIds = new Set((blocks || []).map((b) => b.blocked_id))

  const { data: convs } = await supabase
    .from('conversations')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  const filtered = (convs || []).filter((c) => !blockedIds.has(otherUserId(c, userId)))

  let conversations: Conversation[] = []

  if (filtered.length) {
    const otherIds = filtered.map((c) => otherUserId(c, userId))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, profile_picture')
      .in('id', otherIds)

    const { data: lastMessages } = await supabase
      .from('messages')
      .select('*, sender:sender_id')
      .in(
        'conversation_id',
        filtered.map((c) => c.id)
      )
      .order('created_at', { ascending: false })

    const lastByConv = new Map<string, Message>()
    for (const m of lastMessages || []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m as Message)
    }

    const { data: unreadCounts } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', filtered.map((c) => c.id))
      .neq('sender_id', userId)
      .is('read_at', null)

    const unreadMap = new Map<string, number>()
    for (const m of unreadCounts || []) {
      unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) || 0) + 1)
    }

    conversations = filtered.map((c) => {
      const oid = otherUserId(c, userId)
      const other_user = profiles?.find((p) => p.id === oid)
      return {
        ...c,
        other_user: other_user || undefined,
        last_message: lastByConv.get(c.id),
        unread_count: unreadMap.get(c.id) || 0,
      }
    })
  }

  const { data: pendingConvs } = await supabase
    .from('conversations')
    .select('*')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'request_pending')
    .order('updated_at', { ascending: false })

  const messageRequests: MessageRequest[] = []
  if (pendingConvs?.length) {
    for (const conv of pendingConvs) {
      const { data: firstMsg } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!firstMsg || firstMsg.sender_id === userId) continue

      const { data: requester } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture')
        .eq('id', firstMsg.sender_id)
        .single()

      const other_user = requester
      messageRequests.push({
        conversation: { ...conv, other_user: other_user || undefined },
        requester: other_user || { id: '', full_name: null, email: null, profile_picture: null },
        last_message: firstMsg as Message,
      })
    }
  }

  let blockedMessages: BlockedPreview[] = []
  const { data: blockRows } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId)

  if (blockRows?.length) {
    const bIds = blockRows.map((b) => b.blocked_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, profile_picture')
      .in('id', bIds)

    const { data: allConvs } = await supabase
      .from('conversations')
      .select('id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

    if (allConvs?.length) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', allConvs.map((c) => c.id))
        .in('sender_id', bIds)
        .order('created_at', { ascending: false })

      const bySender = new Map<string, Message>()
      for (const m of msgs || []) {
        if (!bySender.has(m.sender_id)) bySender.set(m.sender_id, m as Message)
      }

      blockedMessages = bIds
        .map((id) => {
          const msg = bySender.get(id)
          const sender = profiles?.find((p) => p.id === id)
          return msg && sender ? { sender, message: msg } : null
        })
        .filter(Boolean) as BlockedPreview[]
    }
  }

  const { data: fpConvs } = await supabase
    .from('conversations')
    .select('id, updated_at, status, user1_id, user2_id')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .in('status', ['active', 'request_pending'])

  const { data: fpBlocks } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId)
  const listFingerprint = computeSidebarListFingerprint(userId, fpBlocks ?? [], fpConvs ?? [])

  return { conversations, messageRequests, blockedMessages, listFingerprint }
}
