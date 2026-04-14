-- Bug reporting system
-- - Any authenticated user can create bug reports and view their own reports
-- - Only super_admin users can view/manage all reports
-- - Optional screenshot uploads are stored in the bug-reports bucket

CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'triaged', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  screenshot_paths TEXT[] NOT NULL DEFAULT '{}',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.bug_report_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.bug_reports(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN ('created', 'status_changed', 'note')),
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS bug_reports_reporter_id_idx ON public.bug_reports(reporter_id);
CREATE INDEX IF NOT EXISTS bug_reports_status_idx ON public.bug_reports(status);
CREATE INDEX IF NOT EXISTS bug_reports_created_at_idx ON public.bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS bug_report_updates_report_id_idx ON public.bug_report_updates(report_id);

CREATE TRIGGER update_bug_reports_updated_at
  BEFORE UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.is_admin_user(uid UUID)
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
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated;

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_report_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_reports_select_own_or_admin"
  ON public.bug_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY "bug_reports_insert_own"
  ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "bug_reports_update_admin"
  ON public.bug_reports FOR UPDATE TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "bug_reports_delete_admin"
  ON public.bug_reports FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "bug_report_updates_select_own_or_admin"
  ON public.bug_report_updates FOR SELECT TO authenticated
  USING (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.bug_reports br
      WHERE br.id = bug_report_updates.report_id
        AND br.reporter_id = auth.uid()
    )
  );

CREATE POLICY "bug_report_updates_insert_own_or_admin"
  ON public.bug_report_updates FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      public.is_admin_user(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.bug_reports br
        WHERE br.id = bug_report_updates.report_id
          AND br.reporter_id = auth.uid()
      )
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-reports', 'bug-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bug_reports_files_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bug-reports'
    AND (
      public.is_admin_user(auth.uid())
      OR split_part(name, '/', 1)::uuid = auth.uid()
    )
  );

CREATE POLICY "bug_reports_files_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bug-reports'
    AND split_part(name, '/', 1)::uuid = auth.uid()
  );

CREATE POLICY "bug_reports_files_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bug-reports' AND public.is_admin_user(auth.uid()));
