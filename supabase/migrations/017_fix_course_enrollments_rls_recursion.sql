-- Fix 42P17: infinite recursion in course_enrollments SELECT policy.
-- The original policy queried course_enrollments inside its own USING clause.

DROP POLICY IF EXISTS "enrollments_select" ON public.course_enrollments;

CREATE POLICY "enrollments_select"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR public.user_enrolled_in_course(auth.uid(), course_id)
  );
