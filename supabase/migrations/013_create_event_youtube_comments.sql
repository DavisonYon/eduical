-- In-app comments on Georgia Tech (or other) YouTube videos shown under Events.
-- Not synced to YouTube; visible only to signed-in Educial users (RLS).

CREATE TABLE IF NOT EXISTS public.event_youtube_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  youtube_video_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT event_youtube_comments_video_id_format CHECK (youtube_video_id ~ '^[a-zA-Z0-9_-]{11}$'),
  CONSTRAINT event_youtube_comments_content_length CHECK (char_length(content) <= 4000 AND char_length(trim(content)) > 0)
);

ALTER TABLE public.event_youtube_comments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_youtube_comments_video_id_created_idx
  ON public.event_youtube_comments (youtube_video_id, created_at DESC);

CREATE INDEX IF NOT EXISTS event_youtube_comments_user_id_idx
  ON public.event_youtube_comments (user_id);

CREATE POLICY "Signed-in users can read event youtube comments"
  ON public.event_youtube_comments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users insert own event youtube comments"
  ON public.event_youtube_comments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own event youtube comments"
  ON public.event_youtube_comments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own event youtube comments"
  ON public.event_youtube_comments
  FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER update_event_youtube_comments_updated_at
  BEFORE UPDATE ON public.event_youtube_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
