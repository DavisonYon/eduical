import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useUnreadMessages } from '../contexts/UnreadMessagesContext'
import { supabase } from '../lib/supabase'
import {
  getOrCreateConversation,
  areFriends,
  isBlocked,
  getConversationUserIds,
} from '../lib/chat'
import type { Conversation, Message, MessageRequest, Profile } from '../lib/messagesTypes'
import {
  fetchLatestMessageIdForConversation,
  fetchSidebarListFingerprint,
  loadSidebarMessagesData,
  loadThreadMessages,
} from '../lib/messagesDataLoader'
import {
  readMessagesUISnapshot,
  writeMessagesUISnapshot,
  invalidateMessagesUICache,
  updateThreadInMessagesCache,
  patchMessagesUISnapshot,
} from '../lib/messagesUICache'
import { mergeIncomingMessageIntoConversations } from '../lib/messagesMerge'

function getInitials(profile: Profile | null | undefined) {
  if (!profile) return 'U'
  if (profile.full_name) {
    const names = profile.full_name.split(' ')
    return (names.length >= 2 ? names[0][0] + names[1][0] : names[0][0]).toUpperCase()
  }
  return profile.email?.[0]?.toUpperCase() ?? 'U'
}

function getDisplayName(profile: Profile | null | undefined) {
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

  const sidebarGenRef = useRef(0)
  const [sidebarReloadToken, setSidebarReloadToken] = useState(0)

  const refreshSidebarFromServer = useCallback(() => {
    if (user) invalidateMessagesUICache(user.id)
    setSidebarReloadToken((t) => t + 1)
  }, [user])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const userId = user.id
    const gen = ++sidebarGenRef.current

    const run = async () => {
      const cached = readMessagesUISnapshot(userId)

      if (cached) {
        if (gen === sidebarGenRef.current) {
          setConversations(cached.conversations)
          setMessageRequests(cached.messageRequests)
          setBlockedMessages(cached.blockedMessages)
          setLoading(false)
        }
      } else if (gen === sidebarGenRef.current) {
        setLoading(true)
      }

      try {
        const fp = await fetchSidebarListFingerprint(userId)
        if (gen !== sidebarGenRef.current) return

        if (cached && fp === cached.listFingerprint) {
          return
        }

        const data = await loadSidebarMessagesData(userId)
        if (gen !== sidebarGenRef.current) return

        setConversations(data.conversations)
        setMessageRequests(data.messageRequests)
        setBlockedMessages(data.blockedMessages)
        writeMessagesUISnapshot({
          userId,
          listFingerprint: data.listFingerprint,
          conversations: data.conversations,
          messageRequests: data.messageRequests,
          blockedMessages: data.blockedMessages,
          threads: {},
        })
      } catch (e) {
        console.error(e)
        if (gen === sidebarGenRef.current && !readMessagesUISnapshot(userId)) {
          setConversations([])
          setMessageRequests([])
          setBlockedMessages([])
        }
      } finally {
        if (gen === sidebarGenRef.current) {
          setLoading(false)
        }
      }
    }

    run()
  }, [user, sidebarReloadToken])

  const fetchMessages = useCallback(
    async (conversationId: string) => {
      if (!user) return

      const uid = user.id
      const snap = readMessagesUISnapshot(uid)
      const cachedThread = snap?.threads[conversationId]
      const latestId = await fetchLatestMessageIdForConversation(conversationId)

      if (cachedThread?.tailMessageId && latestId === cachedThread.tailMessageId) {
        setMessages(cachedThread.messages)
        await markAsRead(conversationId)
        setConversations((prev) => {
          const next = prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
          patchMessagesUISnapshot(uid, { conversations: next })
          return next
        })
        scrollToBottom()
        return
      }

      const { messages: withSenders, tailMessageId } = await loadThreadMessages(conversationId)
      setMessages(withSenders)
      updateThreadInMessagesCache(uid, conversationId, withSenders, tailMessageId)
      await markAsRead(conversationId)
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
        patchMessagesUISnapshot(uid, { conversations: next })
        return next
      })
      scrollToBottom()
    },
    [user, markAsRead]
  )

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
        refreshSidebarFromServer()
      }
      openConversation()
    }
  }, [withUserId, user, loading, fetchMessages, refreshSidebarFromServer])

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
        async (payload) => {
          const msg = payload.new as Message
          const uid = user.id
          const selectedId = selectedConversation?.id ?? null

          if (selectedId === msg.conversation_id) {
            setMessages((prev) => {
              const next = prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
              updateThreadInMessagesCache(uid, msg.conversation_id, next, msg.id)
              return next
            })
            scrollToBottom()
            await markAsRead(msg.conversation_id)
          }

          setConversations((prev) => {
            const { next, convMissing } = mergeIncomingMessageIntoConversations(
              prev,
              msg,
              uid,
              selectedId
            )

            if (convMissing) {
              loadSidebarMessagesData(uid).then((data) => {
                const snap = readMessagesUISnapshot(uid)
                writeMessagesUISnapshot({
                  userId: uid,
                  listFingerprint: data.listFingerprint,
                  conversations: data.conversations,
                  messageRequests: data.messageRequests,
                  blockedMessages: data.blockedMessages,
                  threads: snap?.threads ?? {},
                })
                setConversations(data.conversations)
                setMessageRequests(data.messageRequests)
                setBlockedMessages(data.blockedMessages)
              })
              return prev
            }

            fetchSidebarListFingerprint(uid).then((fp) => {
              const snap = readMessagesUISnapshot(uid)
              writeMessagesUISnapshot({
                userId: uid,
                listFingerprint: fp,
                conversations: next,
                messageRequests: snap?.messageRequests ?? [],
                blockedMessages: snap?.blockedMessages ?? [],
                threads: snap?.threads ?? {},
              })
            })

            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, selectedConversation?.id, markAsRead])

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

      const optimistic: Message = {
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
      }

      setConversations((prev) => {
        const { next } = mergeIncomingMessageIntoConversations(
          prev,
          optimistic,
          user.id,
          selectedConversation.id
        )
        fetchSidebarListFingerprint(user.id).then((fp) => {
          const snap = readMessagesUISnapshot(user.id)
          writeMessagesUISnapshot({
            userId: user.id,
            listFingerprint: fp,
            conversations: next,
            messageRequests: snap?.messageRequests ?? [],
            blockedMessages: snap?.blockedMessages ?? [],
            threads: snap?.threads ?? {},
          })
        })
        return next
      })
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
    refreshSidebarFromServer()
  }

  const handleDeclineRequest = async (conv: Conversation) => {
    await supabase.from('conversations').delete().eq('id', conv.id)
    setMessageRequests((prev) => prev.filter((r) => r.conversation.id !== conv.id))
    if (selectedConversation?.id === conv.id) setSelectedConversation(null)
    refreshSidebarFromServer()
  }

  const handleBlockUser = async (userId: string) => {
    if (!user) return
    await supabase.from('user_blocks').insert({ blocker_id: user.id, blocked_id: userId })
    setSelectedConversation(null)
    refreshSidebarFromServer()
  }

  const handleUnblockUser = async (userId: string) => {
    if (!user) return
    await supabase.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId)
    refreshSidebarFromServer()
  }

  const isRequestReceiver =
    selectedConversation?.status === 'request_pending' &&
    messageRequests.some((r) => r.conversation.id === selectedConversation.id)
  const canSendInConversation =
    selectedConversation?.status === 'active' ||
    (selectedConversation?.status === 'request_pending' && !isRequestReceiver)

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex w-80 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-800">
          <div className="border-b border-gray-200 p-4 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-600 dark:text-gray-400">Loading...</div>
            ) : (
              <>
                {messageRequests.length > 0 && (
                  <div className="border-b border-gray-200 dark:border-gray-800">
                    <button
                      onClick={() => setShowBlocked(false)}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-blue-600 hover:bg-gray-100 dark:text-blue-400 dark:hover:bg-gray-800"
                    >
                      Message Requests ({messageRequests.length})
                    </button>
                    {!showBlocked &&
                      messageRequests.map((req) => (
                        <div
                          key={req.conversation.id}
                          className={`flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                            selectedConversation?.id === req.conversation.id ? 'bg-gray-100 dark:bg-gray-800' : ''
                          }`}
                          onClick={() => {
                            setShowBlocked(false)
                            setSelectedConversation(req.conversation)
                          }}
                        >
                          {req.requester.profile_picture ? (
                            <img
                              src={req.requester.profile_picture}
                              alt={getDisplayName(req.requester)}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                              <span className="text-sm text-gray-800 dark:text-white">{getInitials(req.requester)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                              {getDisplayName(req.requester)}
                            </p>
                            <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                              {req.last_message.content.slice(0, 40)}
                              {req.last_message.content.length > 40 ? '...' : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <div className="p-2">
                  <p className="px-2 py-1 text-xs font-medium uppercase text-gray-600 dark:text-gray-500">
                    Recent
                  </p>
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        selectedConversation?.id === conv.id ? 'bg-gray-100 dark:bg-gray-800' : ''
                      }`}
                      onClick={() => {
                        setShowBlocked(false)
                        setSelectedConversation(conv)
                      }}
                    >
                      {conv.other_user?.profile_picture ? (
                        <img
                          src={conv.other_user.profile_picture}
                          alt={getDisplayName(conv.other_user)}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                          <span className="text-sm text-gray-800 dark:text-white">
                            {getInitials(conv.other_user)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {getDisplayName(conv.other_user)}
                        </p>
                        <p className="truncate text-xs text-gray-600 dark:text-gray-400">
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
                  <div className="mt-auto border-t border-gray-200 dark:border-gray-800">
                    <button
                      onClick={() => setShowBlocked(!showBlocked)}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      Blocked ({blockedMessages.length})
                    </button>
                    {showBlocked &&
                      blockedMessages.map(({ sender, message }) => (
                        <div
                          key={sender.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          {sender.profile_picture ? (
                            <img
                              src={sender.profile_picture}
                              alt={getDisplayName(sender)}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                              <span className="text-sm text-gray-800 dark:text-white">{getInitials(sender)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm text-gray-900 dark:text-white">{getDisplayName(sender)}</p>
                            <p className="truncate text-xs text-gray-600 dark:text-gray-400">{message.content}</p>
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
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  {selectedConversation.other_user?.profile_picture ? (
                    <img
                      src={selectedConversation.other_user.profile_picture}
                      alt={getDisplayName(selectedConversation.other_user)}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                      <span className="text-sm text-gray-800 dark:text-white">
                        {getInitials(selectedConversation.other_user)}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
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
                    className="text-sm text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
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
                          : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.sender_id === user?.id ? 'text-blue-200' : 'text-gray-600 dark:text-gray-500'
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
                <div className="border-t border-gray-200 p-4 dark:border-gray-800">
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
                        className="flex-1 rounded-lg bg-gray-200 py-2 px-4 text-sm font-medium text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
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
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
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
            <div className="flex flex-1 items-center justify-center text-gray-600 dark:text-gray-500">
              <div className="text-center">
                <svg
                  className="mx-auto mb-4 h-16 w-16 text-gray-400 dark:text-gray-600"
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
                <p className="text-lg text-gray-900 dark:text-gray-100">Select a conversation or start a new one</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Click a name in the contacts list to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
  )
}
