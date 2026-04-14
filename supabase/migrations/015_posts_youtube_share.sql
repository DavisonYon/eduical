-- Allow users to share Georgia Tech YouTube videos as posts on their feed.
-- Engagement (likes, views, comments) uses existing event_* tables keyed by youtube_video_id.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS youtube_published_at TIMESTAMPTZ NULL;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_youtube_video_id_format;
ALTER TABLE public.posts ADD CONSTRAINT posts_youtube_video_id_format
  CHECK (youtube_video_id IS NULL OR youtube_video_id ~ '^[a-zA-Z0-9_-]{11}$');

-- YouTube shares must not carry GIF/images (video is the media).
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_youtube_share_media;
ALTER TABLE public.posts ADD CONSTRAINT posts_youtube_share_media
  CHECK (
    youtube_video_id IS NULL
    OR (
      gif_url IS NULL
      AND images = '[]'::jsonb
    )
  );

CREATE INDEX IF NOT EXISTS posts_youtube_video_id_idx
  ON public.posts (youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;
