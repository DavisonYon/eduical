-- Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  gif_url TEXT,
  location TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'friends')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS posts_status_idx ON public.posts(status);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_visibility_idx ON public.posts(visibility);

-- Policy: Users can view published public posts
CREATE POLICY "Users can view published public posts"
  ON public.posts
  FOR SELECT
  USING (
    status = 'published' AND 
    (visibility = 'public' OR user_id = auth.uid())
  );

-- Policy: Users can view their own posts (including drafts)
CREATE POLICY "Users can view own posts"
  ON public.posts
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can create their own posts
CREATE POLICY "Users can create own posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON public.posts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON public.posts
  FOR DELETE
  USING (user_id = auth.uid());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on post updates
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
