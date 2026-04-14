-- Add optional student_id to profiles and make new signups unverified by default.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS student_id TEXT;

ALTER TABLE public.profiles
ALTER COLUMN role SET DEFAULT 'unverified';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, student_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'student_id', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
