import type { Conversation, Message } from './messagesTypes'

/** Update sidebar row for a new message; reorder by updated_at. Returns convMissing if thread not in list. */
export function mergeIncomingMessageIntoConversations(
  prev: Conversation[],
  msg: Pick<Message, 'id' | 'conversation_id' | 'sender_id' | 'content' | 'read_at' | 'created_at'>,
  userId: string,
  selectedConversationId: string | null
): { next: Conversation[]; convMissing: boolean } {
  const idx = prev.findIndex((c) => c.id === msg.conversation_id)
  if (idx === -1) return { next: prev, convMissing: true }

  const c = prev[idx]
  const fromOther = msg.sender_id !== userId
  const isSelected = msg.conversation_id === selectedConversationId

  let unread_count = c.unread_count ?? 0
  if (fromOther && !isSelected) unread_count += 1
  if (fromOther && isSelected) unread_count = 0

  const lastSender =
    c.last_message?.sender_id === msg.sender_id ? c.last_message?.sender : undefined

  const nextConv: Conversation = {
    ...c,
    last_message: {
      ...msg,
      sender: lastSender,
    } as Message,
    updated_at: msg.created_at,
    unread_count,
  }

  const rest = prev.filter((_, i) => i !== idx)
  return {
    next: [nextConv, ...rest].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ),
    convMissing: false,
  }
}
