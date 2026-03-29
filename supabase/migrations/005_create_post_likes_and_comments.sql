-- Create post_likes table for tracking likes on posts
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT post_likes_unique UNIQUE (post_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS post_likes_user_id_idx ON public.post_likes(user_id);

-- Policy: Anyone can see likes (for counts / social proof)
CREATE POLICY "Anyone can view post likes"
  ON public.post_likes
  FOR SELECT
  USING (true);

-- Policy: Users can like posts as themselves
CREATE POLICY "Users can like posts as themselves"
  ON public.post_likes
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can remove their own likes
CREATE POLICY "Users can remove their own likes"
  ON public.post_likes
  FOR DELETE
  USING (user_id = auth.uid());

-- Create post_comments table for comments on posts
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable Row Level Security
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS post_comments_user_id_idx ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS post_comments_created_at_idx ON public.post_comments(created_at DESC);

-- Policy: Anyone can read comments on posts
CREATE POLICY "Anyone can view post comments"
  ON public.post_comments
  FOR SELECT
  USING (true);

-- Policy: Users can create comments as themselves
CREATE POLICY "Users can create comments as themselves"
  ON public.post_comments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON public.post_comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON public.post_comments
  FOR DELETE
  USING (user_id = auth.uid());

