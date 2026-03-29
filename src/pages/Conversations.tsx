import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUnreadMessages } from '../contexts/UnreadMessagesContext'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import {
  getOrCreateConversation,
  areFriends,
  isBlocked,
  getConversationUserIds,
} from '../lib/chat'

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  profile_picture: string | null
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
  sender?: Profile
}

interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  status: string
  updated_at: string
  other_user?: Profile
  last_message?: Message
  unread_count?: number
}

interface MessageRequest {
  conversation: Conversation
  requester: Profile
  last_message: Message
}

function getInitials(profile: Profile | null) {
  if (!profile) return 'U'
  if (profile.full_name) {
    const names = profile.full_name.split(' ')
    return (names.length >= 2 ? names[0][0] + names[1][0] : names[0][0]).toUpperCase()
  }
  return profile.email?.[0]?.toUpperCase() ?? 'U'
}

function getDisplayName(profile: Profile | null) {
  return profile?.full_name || profile?.email || 'Unknown'
}

export default function Conversations() {
  const { user } = useAuth()
  const { markAsRead } = useUnreadMessages()
  const [searchParams] = useSearchParams()
  const withUserId = searchParams.get('with')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messageRequests, setMessageRequests] = useState<MessageRequest[]>([])
  const [blockedMessages, setBlockedMessages] = useState<{ sender: Profile; message: Message }[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const getOtherUserId = (conv: Conversation) =>
    conv.user1_id === user?.id ? conv.user2_id : conv.user1_id

  const fetchConversations = useCallback(async () => {
    if (!user) return

    const { data: blocks } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)
    const blockedIds = new Set((blocks || []).map((b) => b.blocked_id))

    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })

    const filtered = (convs || []).filter((c) => {
      const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id
      return !blockedIds.has(otherId)
    })

    if (!filtered.length) {
      setConversations([])
      return
    }

    const otherIds = filtered.map((c) => (c.user1_id === user.id ? c.user2_id : c.user1_id))
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
      .neq('sender_id', user.id)
      .is('read_at', null)

    const unreadMap = new Map<string, number>()
    for (const m of unreadCounts || []) {
      unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) || 0) + 1)
    }

    const withProfiles = filtered.map((c) => {
      const otherId = getOtherUserId(c)
      const other_user = profiles?.find((p) => p.id === otherId)
      return {
        ...c,
        other_user: other_user || null,
        last_message: lastByConv.get(c.id),
        unread_count: unreadMap.get(c.id) || 0,
      }
    })

    setConversations(withProfiles)
  }, [user])

  const fetchMessageRequests = useCallback(async () => {
    if (!user) return

    const { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .eq('status', 'request_pending')
      .order('updated_at', { ascending: false })

    if (!convs?.length) {
      setMessageRequests([])
      return
    }

    const requests: MessageRequest[] = []
    for (const conv of convs) {
      const { data: firstMsg } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!firstMsg || firstMsg.sender_id === user.id) continue

      const { data: requester } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture')
        .eq('id', firstMsg.sender_id)
        .single()

      const otherId = getOtherUserId(conv)
      const other_user = requester
      requests.push({
        conversation: { ...conv, other_user: other_user || undefined },
        requester: other_user || { id: '', full_name: null, email: null, profile_picture: null },
        last_message: firstMsg as Message,
      })
    }
    setMessageRequests(requests)
  }, [user])

  const fetchBlockedMessages = useCallback(async () => {
    if (!user) return

    const { data: blocks } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)

    if (!blocks?.length) {
      setBlockedMessages([])
      return
    }

    const blockedIds = blocks.map((b) => b.blocked_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, profile_picture')
      .in('id', blockedIds)

    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)

    if (!convs?.length) {
      setBlockedMessages([])
      return
    }

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convs.map((c) => c.id))
      .in('sender_id', blockedIds)
      .order('created_at', { ascending: false })

    const bySender = new Map<string, Message>()
    for (const m of msgs || []) {
      if (!bySender.has(m.sender_id)) bySender.set(m.sender_id, m as Message)
    }

    const list = blockedIds
      .map((id) => {
        const msg = bySender.get(id)
        const sender = profiles?.find((p) => p.id === id)
        return msg && sender ? { sender, message: msg } : null
      })
      .filter(Boolean) as { sender: Profile; message: Message }[]

    setBlockedMessages(list)
  }, [user])

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      if (!user) return

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      const msgList = data || []
      const senderIds = [...new Set(msgList.map((m) => m.sender_id))]
      const { data: senders } = await supabase
        .from('profiles')
        .select('id, full_name, email, profile_picture')
        .in('id', senderIds)

      const withSenders = msgList.map((m) => ({
        ...m,
        sender: senders?.find((s) => s.id === m.sender_id),
      }))

      setMessages(withSenders)
      await markAsRead(conversationId)
      scrollToBottom()
    },
    [user, markAsRead]
  )

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([fetchConversations(), fetchMessageRequests(), fetchBlockedMessages()]).finally(
      () => setLoading(false)
    )
  }, [user, fetchConversations, fetchMessageRequests, fetchBlockedMessages])

  useEffect(() => {
    if (withUserId && user && !loading) {
      const openConversation = async () => {
        const friends = await areFriends(user.id, withUserId)
        const blocked = await isBlocked(user.id, withUserId)
        if (blocked) return

        const conv = await getOrCreateConversation(user.id, withUserId, friends)
        if (!conv) return

        const [u1, u2] = getConversationUserIds(user.id, withUserId)
        const { data: other } = await supabase
          .from('profiles')
          .select('id, full_name, email, profile_picture')
          .eq('id', withUserId)
          .single()

        const conversation: Conversation = {
          id: conv.id,
          user1_id: u1,
          user2_id: u2,
          status: conv.status,
          updated_at: new Date().toISOString(),
          other_user: other || undefined,
        }

        setSelectedConversation(conversation)
        await fetchMessages(conv.id)
        await fetchConversations()
        await fetchMessageRequests()
      }
      openConversation()
    }
  }, [withUserId, user, loading])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id)
    } else {
      setMessages([])
    }
  }, [selectedConversation?.id, fetchMessages])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message
          if (selectedConversation?.id === msg.conversation_id) {
            setMessages((prev) => [...prev, msg])
            scrollToBottom()
            markAsRead(msg.conversation_id)
          }
          fetchConversations()
          fetchMessageRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, selectedConversation?.id, fetchConversations, fetchMessageRequests, markAsRead])

  const handleSendMessage = async () => {
    if (!user || !selectedConversation || !newMessage.trim() || sending) return

    const content = newMessage.trim()
    setSending(true)
    setNewMessage('')
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content,
      })

      if (error) throw error
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          content,
          read_at: null,
          created_at: new Date().toISOString(),
          sender: {
            id: user.id,
            full_name: user.user_metadata?.full_name || null,
            email: user.email || null,
            profile_picture: null,
          },
        },
      ])
      scrollToBottom()
      await fetchConversations()
    } catch (err) {
      console.error('Error sending message:', err)
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  const handleAcceptRequest = async (conv: Conversation) => {
    await supabase
      .from('conversations')
      .update({ status: 'active' })
      .eq('id', conv.id)
    setSelectedConversation(conv)
    await fetchMessages(conv.id)
    fetchMessageRequests()
    fetchConversations()
  }

  const handleDeclineRequest = async (conv: Conversation) => {
    await supabase.from('conversations').delete().eq('id', conv.id)
    setMessageRequests((prev) => prev.filter((r) => r.conversation.id !== conv.id))
    if (selectedConversation?.id === conv.id) setSelectedConversation(null)
  }

  const handleBlockUser = async (userId: string) => {
    if (!user) return
    await supabase.from('user_blocks').insert({ blocker_id: user.id, blocked_id: userId })
    setSelectedConversation(null)
    fetchConversations()
    fetchMessageRequests()
    fetchBlockedMessages()
  }

  const handleUnblockUser = async (userId: string) => {
    if (!user) return
    await supabase.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId)
    fetchBlockedMessages()
  }

  const isRequestReceiver =
    selectedConversation?.status === 'request_pending' &&
    messageRequests.some((r) => r.conversation.id === selectedConversation.id)
  const canSendInConversation =
    selectedConversation?.status === 'active' ||
    (selectedConversation?.status === 'request_pending' && !isRequestReceiver)

  return (
    <Layout>
      <div className="flex h-[calc(100vh-8rem)] bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="w-80 border-r border-gray-800 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-gray-400 text-sm">Loading...</div>
            ) : (
              <>
                {messageRequests.length > 0 && (
                  <div className="border-b border-gray-800">
                    <button
                      onClick={() => setShowBlocked(false)}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-blue-400 hover:bg-gray-800"
                    >
                      Message Requests ({messageRequests.length})
                    </button>
                    {!showBlocked &&
                      messageRequests.map((req) => (
                        <div
                          key={req.conversation.id}
                          className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-800 ${
                            selectedConversation?.id === req.conversation.id ? 'bg-gray-800' : ''
                          }`}
                          onClick={() => {
                            setShowBlocked(false)
                            setSelectedConversation(req.conversation)
                            fetchMessages(req.conversation.id)
                          }}
                        >
                          {req.requester.profile_picture ? (
                            <img
                              src={req.requester.profile_picture}
                              alt={getDisplayName(req.requester)}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                              <span className="text-white text-sm">{getInitials(req.requester)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">
                              {getDisplayName(req.requester)}
                            </p>
                            <p className="text-gray-400 text-xs truncate">
                              {req.last_message.content.slice(0, 40)}
                              {req.last_message.content.length > 40 ? '...' : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">
                    Recent
                  </p>
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-800 ${
                        selectedConversation?.id === conv.id ? 'bg-gray-800' : ''
                      }`}
                      onClick={() => {
                        setShowBlocked(false)
                        setSelectedConversation(conv)
                        fetchMessages(conv.id)
                      }}
                    >
                      {conv.other_user?.profile_picture ? (
                        <img
                          src={conv.other_user.profile_picture}
                          alt={getDisplayName(conv.other_user)}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                          <span className="text-white text-sm">
                            {getInitials(conv.other_user)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate font-medium">
                          {getDisplayName(conv.other_user)}
                        </p>
                        <p className="text-gray-400 text-xs truncate">
                          {conv.last_message?.content?.slice(0, 30) || 'No messages yet'}
                          {(conv.last_message?.content?.length || 0) > 30 ? '...' : ''}
                        </p>
                      </div>
                      {conv.unread_count ? (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                          {conv.unread_count}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                {blockedMessages.length > 0 && (
                  <div className="border-t border-gray-800 mt-auto">
                    <button
                      onClick={() => setShowBlocked(!showBlocked)}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-gray-400 hover:bg-gray-800"
                    >
                      Blocked ({blockedMessages.length})
                    </button>
                    {showBlocked &&
                      blockedMessages.map(({ sender, message }) => (
                        <div
                          key={sender.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-800"
                        >
                          {sender.profile_picture ? (
                            <img
                              src={sender.profile_picture}
                              alt={getDisplayName(sender)}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                              <span className="text-white text-sm">{getInitials(sender)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">{getDisplayName(sender)}</p>
                            <p className="text-gray-400 text-xs truncate">{message.content}</p>
                          </div>
                          <button
                            onClick={() => handleUnblockUser(sender.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {selectedConversation ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  {selectedConversation.other_user?.profile_picture ? (
                    <img
                      src={selectedConversation.other_user.profile_picture}
                      alt={getDisplayName(selectedConversation.other_user)}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-white text-sm">
                        {getInitials(selectedConversation.other_user)}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium">
                      {getDisplayName(selectedConversation.other_user)}
                    </p>
                    {selectedConversation.status === 'request_pending' && (
                      <p className="text-xs text-amber-400">Message request</p>
                    )}
                  </div>
                </div>
                {selectedConversation.other_user && (
                  <button
                    onClick={() => handleBlockUser(selectedConversation.other_user!.id)}
                    className="text-sm text-gray-400 hover:text-red-400"
                  >
                    Block
                  </button>
                )}
              </div>

              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        msg.sender_id === user?.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender_id === user?.id ? 'text-blue-200' : 'text-gray-500'
                        }`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {(selectedConversation.status === 'active' || canSendInConversation || isRequestReceiver) && (
                <div className="p-4 border-t border-gray-800">
                  {isRequestReceiver ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAcceptRequest(selectedConversation)}
                        className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(selectedConversation)}
                        className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleSendMessage()
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!canSendInConversation || sending}
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium"
                      >
                        Send
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-lg">Select a conversation or start a new one</p>
                <p className="text-sm mt-1">
                  Click a name in the contacts list to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
