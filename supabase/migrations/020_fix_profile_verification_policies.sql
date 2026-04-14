-- Fix verification workflow permissions:
-- 1) super_admin can update any profile (verify/reject users)
-- 2) non-super-admin users cannot change role directly

CREATE POLICY "Super admin can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_profile_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can change profile roles';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_profile_role_change ON public.profiles;
CREATE TRIGGER enforce_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_profile_role_change();
