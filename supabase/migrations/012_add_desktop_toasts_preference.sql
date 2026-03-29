-- Add desktop toast notifications preference to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS desktop_toasts_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.desktop_toasts_enabled IS 'When true, show toast notifications in bottom-right (e.g. new messages). Desktop only.';
