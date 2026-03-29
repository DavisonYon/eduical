-- Organizations represent student groups / clubs / organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_private BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Memberships link users to organizations with roles and statuses
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'manager', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'banned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (organization_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS organizations_created_by_idx ON public.organizations(created_by);
CREATE INDEX IF NOT EXISTS organization_memberships_org_id_idx ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS organization_memberships_user_id_idx ON public.organization_memberships(user_id);

-- For now, allow any authenticated user to view organizations
CREATE POLICY "Anyone can view organizations"
  ON public.organizations
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- For now, allow any authenticated user to view memberships
CREATE POLICY "Anyone can view organization memberships"
  ON public.organization_memberships
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow any authenticated user to create an organization (app layer will later restrict to super_admin)
CREATE POLICY "Users can create organizations"
  ON public.organizations
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow members to manage their own membership rows (app layer will enforce finer-grained roles later)
CREATE POLICY "Users can manage own memberships"
  ON public.organization_memberships
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

