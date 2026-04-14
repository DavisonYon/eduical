-- Scoped RBAC for super_admin user management portal.
-- Supports dynamic roles, custom permissions, and scoped assignments (global/course/chat).

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'course', 'chat')),
  scope_id UUID,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT user_role_assignments_scope_required CHECK (
    (scope_type = 'global' AND scope_id IS NULL)
    OR (scope_type IN ('course', 'chat') AND scope_id IS NOT NULL)
  ),
  CONSTRAINT user_role_assignments_unique UNIQUE (user_id, role_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS roles_key_idx ON public.roles(key);
CREATE INDEX IF NOT EXISTS permissions_key_idx ON public.permissions(key);
CREATE INDEX IF NOT EXISTS role_permissions_role_id_idx ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_id_idx ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS user_role_assignments_user_id_idx ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS user_role_assignments_scope_idx ON public.user_role_assignments(scope_type, scope_id);

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

-- Keep super admin check compatible while enabling RBAC.
CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.role = 'super_admin'
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE ura.user_id = uid
      AND ura.scope_type = 'global'
      AND r.key = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_global_permission(uid UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    JOIN public.permissions pm ON pm.id = rp.permission_id
    WHERE ura.user_id = uid
      AND ura.scope_type = 'global'
      AND pm.key = permission_key
  );
$$;

CREATE OR REPLACE FUNCTION public.has_scoped_permission(
  uid UUID,
  permission_key TEXT,
  target_scope_type TEXT,
  target_scope_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    public.has_global_permission(uid, permission_key)
    OR EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions pm ON pm.id = rp.permission_id
      WHERE ura.user_id = uid
        AND ura.scope_type = target_scope_type
        AND ura.scope_id = target_scope_id
        AND pm.key = permission_key
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_permission(
  permission_key TEXT,
  target_scope_type TEXT DEFAULT 'global',
  target_scope_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN target_scope_type = 'global' THEN public.has_global_permission(auth.uid(), permission_key)
    ELSE public.has_scoped_permission(auth.uid(), permission_key, target_scope_type, target_scope_id)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.has_global_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_scoped_permission(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(TEXT, TEXT, UUID) TO authenticated;

-- Super-admin-only management for RBAC config tables.
CREATE POLICY "roles_select_super_admin"
  ON public.roles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "roles_insert_super_admin"
  ON public.roles FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "roles_update_super_admin"
  ON public.roles FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "roles_delete_super_admin"
  ON public.roles FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "permissions_select_super_admin"
  ON public.permissions FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "permissions_insert_super_admin"
  ON public.permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "permissions_update_super_admin"
  ON public.permissions FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "permissions_delete_super_admin"
  ON public.permissions FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "role_permissions_select_super_admin"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "role_permissions_insert_super_admin"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "role_permissions_delete_super_admin"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "user_role_assignments_select_super_admin"
  ON public.user_role_assignments FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "user_role_assignments_insert_super_admin"
  ON public.user_role_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "user_role_assignments_update_super_admin"
  ON public.user_role_assignments FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "user_role_assignments_delete_super_admin"
  ON public.user_role_assignments FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Seed baseline permissions (includes configurable feature permissions).
INSERT INTO public.permissions (key, description) VALUES
  ('system.super_admin', 'Full platform access'),
  ('users.manage', 'Manage users and role assignments'),
  ('roles.manage', 'Create roles and manage permission mappings'),
  ('bug_reports.manage', 'Manage bug reports queue'),
  ('accounts.verify', 'Verify or reject pending accounts'),
  ('course.announcements.manage', 'Post/edit course announcements'),
  ('chat.moderate', 'Moderate chat messages in scoped conversations')
ON CONFLICT (key) DO NOTHING;

-- Seed baseline roles.
INSERT INTO public.roles (key, label, description, is_system) VALUES
  ('super_admin', 'Super Admin', 'Full system management', true),
  ('admin', 'Admin', 'General administration role', true),
  ('member', 'Member', 'Standard verified user role', true),
  ('ta', 'Teaching Assistant', 'Scoped moderation/course operations', false)
ON CONFLICT (key) DO NOTHING;

-- Role permission mappings.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN (
  'system.super_admin',
  'users.manage',
  'roles.manage',
  'bug_reports.manage',
  'accounts.verify',
  'course.announcements.manage',
  'chat.moderate'
)
WHERE r.key = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key IN ('course.announcements.manage', 'chat.moderate')
WHERE r.key = 'ta'
ON CONFLICT DO NOTHING;

-- Compatibility backfill: mirror profiles.role into global RBAC assignments.
INSERT INTO public.user_role_assignments (user_id, role_id, scope_type, scope_id, assigned_by)
SELECT p.id, r.id, 'global', NULL, NULL
FROM public.profiles p
JOIN public.roles r ON r.key = p.role
ON CONFLICT (user_id, role_id, scope_type, scope_id) DO NOTHING;

-- Allow chat moderation via scoped RBAC.
CREATE POLICY "messages_delete_scoped_moderator"
  ON public.messages FOR DELETE TO authenticated
  USING (
    public.has_scoped_permission(auth.uid(), 'chat.moderate', 'chat', conversation_id)
    OR sender_id = auth.uid()
  );

-- Allow TA/super-admin course announcement writes via scoped RBAC.
DROP POLICY IF EXISTS "notifications_insert_super_admin" ON public.course_notifications;
CREATE POLICY "notifications_insert_scoped_permission"
  ON public.course_notifications FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_scoped_permission(auth.uid(), 'course.announcements.manage', 'course', course_id)
  );

DROP POLICY IF EXISTS "notifications_update_super_admin" ON public.course_notifications;
CREATE POLICY "notifications_update_scoped_permission"
  ON public.course_notifications FOR UPDATE TO authenticated
  USING (public.has_scoped_permission(auth.uid(), 'course.announcements.manage', 'course', course_id));

DROP POLICY IF EXISTS "notifications_delete_super_admin" ON public.course_notifications;
CREATE POLICY "notifications_delete_scoped_permission"
  ON public.course_notifications FOR DELETE TO authenticated
  USING (public.has_scoped_permission(auth.uid(), 'course.announcements.manage', 'course', course_id));
