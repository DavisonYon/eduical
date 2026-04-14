-- Educial-only engagement for event YouTube embeds (not synced to YouTube).

CREATE TABLE IF NOT EXISTS public.event_youtube_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  youtube_video_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT event_youtube_likes_video_format CHECK (youtube_video_id ~ '^[a-zA-Z0-9_-]{11}$'),
  CONSTRAINT event_youtube_likes_unique UNIQUE (youtube_video_id, user_id)
);

ALTER TABLE public.event_youtube_likes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_youtube_likes_video_id_idx ON public.event_youtube_likes (youtube_video_id);

CREATE POLICY "Signed-in users can read event youtube likes"
  ON public.event_youtube_likes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users insert own event youtube likes"
  ON public.event_youtube_likes
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own event youtube likes"
  ON public.event_youtube_likes
  FOR DELETE
  USING (user_id = auth.uid());

-- One row per in-app view (count rows for total Educial views).
CREATE TABLE IF NOT EXISTS public.event_youtube_view_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  youtube_video_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT event_youtube_view_events_video_format CHECK (youtube_video_id ~ '^[a-zA-Z0-9_-]{11}$')
);

ALTER TABLE public.event_youtube_view_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS event_youtube_view_events_video_idx ON public.event_youtube_view_events (youtube_video_id);
CREATE INDEX IF NOT EXISTS event_youtube_view_events_user_idx ON public.event_youtube_view_events (user_id);

CREATE POLICY "Signed-in users can read event youtube view events"
  ON public.event_youtube_view_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users insert own event youtube view events"
  ON public.event_youtube_view_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());
