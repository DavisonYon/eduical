-- Add additional profile fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS degree_type TEXT CHECK (degree_type IN ('undergrad', 'masters', 'phd', 'post-bach', 'continuing-edu')),
ADD COLUMN IF NOT EXISTS graduation_year INTEGER,
ADD COLUMN IF NOT EXISTS past_schools JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS major TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS website_url TEXT,
ADD COLUMN IF NOT EXISTS profile_picture TEXT; -- Base64 encoded image or URL

-- Add index for degree_type for filtering
CREATE INDEX IF NOT EXISTS profiles_degree_type_idx ON public.profiles(degree_type);

-- Add index for graduation_year for sorting/filtering
CREATE INDEX IF NOT EXISTS profiles_graduation_year_idx ON public.profiles(graduation_year);

-- Note: RLS policies already exist from initial profiles table creation
-- Users can view all profiles (from migration 002)
-- Users can update their own profile (from migration 000)
