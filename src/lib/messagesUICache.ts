import type { Conversation, Message, MessageRequest, BlockedPreview } from './messagesTypes'

export type ThreadCacheEntry = {
  messages: Message[]
  tailMessageId: string | null
}

export type MessagesUISnapshot = {
  userId: string
  listFingerprint: string
  conversations: Conversation[]
  messageRequests: MessageRequest[]
  blockedMessages: BlockedPreview[]
  threads: Record<string, ThreadCacheEntry>
}

let snapshot: MessagesUISnapshot | null = null

export function readMessagesUISnapshot(userId: string): MessagesUISnapshot | null {
  if (snapshot?.userId === userId) return snapshot
  return null
}

export function writeMessagesUISnapshot(next: MessagesUISnapshot): void {
  snapshot = next
}

export function patchMessagesUISnapshot(userId: string, partial: Partial<MessagesUISnapshot>): void {
  if (!snapshot || snapshot.userId !== userId) return
  snapshot = { ...snapshot, ...partial }
}

export function updateThreadInMessagesCache(
  userId: string,
  conversationId: string,
  messages: Message[],
  tailMessageId: string | null
): void {
  if (!snapshot || snapshot.userId !== userId) return
  snapshot = {
    ...snapshot,
    threads: {
      ...snapshot.threads,
      [conversationId]: { messages, tailMessageId },
    },
  }
}

export function invalidateMessagesUICache(userId?: string): void {
  if (userId == null || snapshot?.userId === userId) {
    snapshot = null
  }
}
