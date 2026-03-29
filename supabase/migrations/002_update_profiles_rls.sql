-- Update profiles RLS to allow viewing other users' profiles (for displaying names in posts)
-- This allows users to see basic profile info (name, email) of other users
-- 
-- IMPORTANT: Run migration 000_create_profiles_table.sql FIRST if profiles table doesn't exist

-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create new policy that allows users to view all profiles (for displaying names)
CREATE POLICY "Users can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Keep existing update and insert policies
-- (They should already exist from the initial setup)
