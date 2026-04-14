-- Allow users with accounts.verify permission to verify/reject users.
-- Keep super_admin unrestricted, but prevent permission-based verifiers from editing unrelated profile fields.

CREATE POLICY "Accounts verify permission can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_global_permission(auth.uid(), 'accounts.verify'))
  WITH CHECK (public.has_global_permission(auth.uid(), 'accounts.verify'));

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF public.has_global_permission(auth.uid(), 'accounts.verify') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF NEW.role NOT IN ('member', 'unverified', 'banned') THEN
        RAISE EXCEPTION 'accounts.verify can only set role to member, unverified, or banned';
      END IF;
    END IF;

    -- Permission-based verifiers can only change the role field.
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.full_name IS DISTINCT FROM OLD.full_name
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.degree_type IS DISTINCT FROM OLD.degree_type
      OR NEW.graduation_year IS DISTINCT FROM OLD.graduation_year
      OR NEW.past_schools IS DISTINCT FROM OLD.past_schools
      OR NEW.major IS DISTINCT FROM OLD.major
      OR NEW.linkedin_url IS DISTINCT FROM OLD.linkedin_url
      OR NEW.github_url IS DISTINCT FROM OLD.github_url
      OR NEW.website_url IS DISTINCT FROM OLD.website_url
      OR NEW.profile_picture IS DISTINCT FROM OLD.profile_picture
      OR NEW.desktop_toasts_enabled IS DISTINCT FROM OLD.desktop_toasts_enabled
      OR NEW.student_id IS DISTINCT FROM OLD.student_id
    THEN
      RAISE EXCEPTION 'accounts.verify cannot update profile fields other than role';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Only super admins or accounts.verify can change profile roles';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
