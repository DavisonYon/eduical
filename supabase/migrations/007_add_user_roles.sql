-- Add role column to profiles for basic role-based access control
-- Roles:
-- - super_admin: Full control over the platform
-- - admin: Elevated permissions for moderation/management
-- - member: Normal verified user
-- - unverified: User awaiting verification/approval
-- - banned: User blocked from using the platform

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('super_admin', 'admin', 'member', 'unverified', 'banned'));

-- Ensure the primary super admin account is correctly set
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'davison.yon@gmail.com';

-- As an initial default, make sure any other existing users remain members
UPDATE public.profiles
SET role = 'member'
WHERE email <> 'davison.yon@gmail.com'
  AND role IS NOT NULL
  AND role <> 'super_admin';

