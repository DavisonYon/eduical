-- Create comment_likes table for tracking likes on comments
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT comment_likes_unique UNIQUE (comment_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS comment_likes_comment_id_idx ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_id_idx ON public.comment_likes(user_id);

-- Policy: Anyone can view comment likes
CREATE POLICY "Anyone can view comment likes"
  ON public.comment_likes
  FOR SELECT
  USING (true);

-- Policy: Users can like comments as themselves
CREATE POLICY "Users can like comments as themselves"
  ON public.comment_likes
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can remove their own comment likes
CREATE POLICY "Users can remove their own comment likes"
  ON public.comment_likes
  FOR DELETE
  USING (user_id = auth.uid());

