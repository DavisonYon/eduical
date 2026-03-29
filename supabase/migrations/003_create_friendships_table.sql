-- Create friendships table for friend requests and relationships
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- Ensure a user can't friend themselves
  CONSTRAINT no_self_friendship CHECK (requester_id != addressee_id),
  -- Ensure unique friendship pairs (one request per pair)
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id)
);

-- Enable Row Level Security
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS friendships_requester_id_idx ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_id_idx ON public.friendships(addressee_id);
CREATE INDEX IF NOT EXISTS friendships_status_idx ON public.friendships(status);
CREATE INDEX IF NOT EXISTS friendships_created_at_idx ON public.friendships(created_at DESC);

-- Composite index for common queries (finding friendships between two users)
CREATE INDEX IF NOT EXISTS friendships_user_pair_idx ON public.friendships(requester_id, addressee_id);

-- Policy: Users can view friendships where they are the requester
CREATE POLICY "Users can view own sent requests"
  ON public.friendships
  FOR SELECT
  USING (requester_id = auth.uid());

-- Policy: Users can view friendships where they are the addressee
CREATE POLICY "Users can view own received requests"
  ON public.friendships
  FOR SELECT
  USING (addressee_id = auth.uid());

-- Policy: Users can create friend requests (as requester)
CREATE POLICY "Users can create friend requests"
  ON public.friendships
  FOR INSERT
  WITH CHECK (requester_id = auth.uid());

-- Policy: Users can update friend requests they received (to accept/decline)
CREATE POLICY "Users can update received requests"
  ON public.friendships
  FOR UPDATE
  USING (addressee_id = auth.uid())
  WITH CHECK (addressee_id = auth.uid());

-- Policy: Users can cancel friend requests they sent
CREATE POLICY "Users can cancel sent requests"
  ON public.friendships
  FOR UPDATE
  USING (requester_id = auth.uid() AND status = 'pending')
  WITH CHECK (requester_id = auth.uid());

-- Policy: Users can delete friendships they're part of
CREATE POLICY "Users can delete own friendships"
  ON public.friendships
  FOR DELETE
  USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_friendships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on friendship updates
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_friendships_updated_at();

-- Create a function to get mutual friends count (optional helper function)
CREATE OR REPLACE FUNCTION public.get_mutual_friends_count(user1_id UUID, user2_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.friendships f1
    JOIN public.friendships f2 ON (
      (f1.addressee_id = f2.requester_id AND f1.requester_id = f2.addressee_id)
      OR
      (f1.requester_id = f2.requester_id AND f1.addressee_id = f2.addressee_id)
    )
    WHERE f1.status = 'accepted'
      AND f2.status = 'accepted'
      AND (
        (f1.requester_id = user1_id OR f1.addressee_id = user1_id)
        AND
        (f2.requester_id = user2_id OR f2.addressee_id = user2_id)
        AND
        NOT (f1.requester_id = user1_id AND f1.addressee_id = user1_id)
        AND
        NOT (f2.requester_id = user2_id AND f2.addressee_id = user2_id)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
