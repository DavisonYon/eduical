import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useNotification } from './NotificationContext'
import { supabase } from '../lib/supabase'

interface UnreadMessagesContextType {
  unreadCount: number
  refreshUnreadCount: () => Promise<void>
  markAsRead: (conversationId: string) => Promise<void>
}

const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(undefined)

export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { addNotification } = useNotification()
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    try {
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)
      const blockedIds = new Set((blocks || []).map((b) => b.blocked_id))

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, user1_id, user2_id')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq('status', 'active')

      if (!conversations?.length) {
        setUnreadCount(0)
        return
      }

      const convIds = conversations
        .filter((c) => {
          const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id
          return !blockedIds.has(otherId)
        })
        .map((c) => c.id)

      if (!convIds.length) {
        setUnreadCount(0)
        return
      }

      const { data: unreadMsgs } = await supabase
        .from('messages')
        .select('id')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)
        .is('read_at', null)

      setUnreadCount(unreadMsgs?.length ?? 0)
    } catch (err) {
      console.error('Error fetching unread count:', err)
      setUnreadCount(0)
    }
  }, [user])

  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!user) return

      try {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .neq('sender_id', user.id)
          .is('read_at', null)

        await fetchUnreadCount()
      } catch (err) {
        console.error('Error marking messages as read:', err)
      }
    },
    [user, fetchUnreadCount]
  )

  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          fetchUnreadCount()

          const msg = payload.new as { sender_id: string; conversation_id: string }
          if (msg.sender_id === user.id) return

          const { data: blocks } = await supabase
            .from('user_blocks')
            .select('blocked_id')
            .eq('blocker_id', user.id)
          if (blocks?.some((b) => b.blocked_id === msg.sender_id)) return

          const { data: conv } = await supabase
            .from('conversations')
            .select('user1_id, user2_id')
            .eq('id', msg.conversation_id)
            .single()
          if (!conv || (conv.user1_id !== user.id && conv.user2_id !== user.id)) return

          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', msg.sender_id)
            .single()
          const fromName = sender?.full_name || sender?.email || 'Someone'

          addNotification({
            type: 'message',
            title: 'New message',
            message: `Message from ${fromName}`,
            duration: 3000,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchUnreadCount, addNotification])

  const value = {
    unreadCount,
    refreshUnreadCount: fetchUnreadCount,
    markAsRead,
  }

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  )
}

export function useUnreadMessages() {
  const context = useContext(UnreadMessagesContext)
  if (context === undefined) {
    throw new Error('useUnreadMessages must be used within an UnreadMessagesProvider')
  }
  return context
}
