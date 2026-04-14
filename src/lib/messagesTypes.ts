export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  profile_picture: string | null
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
  sender?: Profile
}

export interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  status: string
  updated_at: string
  other_user?: Profile
  last_message?: Message
  unread_count?: number
}

export interface MessageRequest {
  conversation: Conversation
  requester: Profile
  last_message: Message
}

export type BlockedPreview = { sender: Profile; message: Message }
