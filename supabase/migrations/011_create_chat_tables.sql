-- Create user_blocks table for blocking users (separate from friendship block)
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
  CONSTRAINT unique_user_block UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS user_blocks_blocker_id_idx ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx ON public.user_blocks(blocked_id);

CREATE POLICY "Users can view own blocks"
  ON public.user_blocks FOR SELECT
  USING (blocker_id = auth.uid());

CREATE POLICY "Users can create blocks"
  ON public.user_blocks FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can delete own blocks"
  ON public.user_blocks FOR DELETE
  USING (blocker_id = auth.uid());

-- Create conversations table (1:1 direct messages)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'request_pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT no_self_conversation CHECK (user1_id != user2_id),
  CONSTRAINT unique_conversation_pair UNIQUE (user1_id, user2_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS conversations_user1_id_idx ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS conversations_user2_id_idx ON public.conversations(user2_id);
CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON public.conversations(updated_at DESC);

CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (user1_id = auth.uid() OR user2_id = auth.uid())
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages(sender_id);

CREATE POLICY "Users can view messages in own conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own messages (for read receipts)"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Trigger to update conversation updated_at when message is inserted
CREATE OR REPLACE FUNCTION public.handle_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_conversation_updated_at();

-- Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
