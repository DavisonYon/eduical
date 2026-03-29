-- Broaden organization membership policies so that admins/owners can approve others

-- Allow platform-level admins to manage any organization membership
CREATE POLICY "Admins can manage all org memberships"
  ON public.organization_memberships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

