-- Courses, enrollments, discussion forum, documents (storage), notifications, read receipts.
-- Super admins manage courses, enrollments, documents, and notifications.

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  semester TEXT,
  term TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT courses_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (course_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.course_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.course_thread_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.course_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.course_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  visible_from TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  visible_until TIMESTAMPTZ,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.course_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.course_notification_reads (
  notification_id UUID NOT NULL REFERENCES public.course_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS course_enrollments_course_id_idx ON public.course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS course_enrollments_user_id_idx ON public.course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS course_threads_course_id_idx ON public.course_threads(course_id);
CREATE INDEX IF NOT EXISTS course_thread_replies_thread_id_idx ON public.course_thread_replies(thread_id);
CREATE INDEX IF NOT EXISTS course_documents_course_id_idx ON public.course_documents(course_id);
CREATE INDEX IF NOT EXISTS course_notifications_course_id_idx ON public.course_notifications(course_id);

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_course_threads_updated_at
  BEFORE UPDATE ON public.course_threads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Helpers (SECURITY DEFINER so RLS can use them safely)
CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.user_enrolled_in_course(uid UUID, cid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments e
    WHERE e.user_id = uid AND e.course_id = cid
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_enrolled_in_course(UUID, UUID) TO authenticated;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_thread_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_notification_reads ENABLE ROW LEVEL SECURITY;

-- courses
CREATE POLICY "courses_select_enrolled_or_super"
  ON public.courses FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_enrolled_in_course(auth.uid(), id)
  );

CREATE POLICY "courses_insert_super_admin"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "courses_update_super_admin"
  ON public.courses FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "courses_delete_super_admin"
  ON public.courses FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- enrollments
-- Use user_enrolled_in_course() (SECURITY DEFINER) instead of EXISTS on course_enrollments
-- to avoid infinite RLS recursion (42P17).
CREATE POLICY "enrollments_select"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR public.user_enrolled_in_course(auth.uid(), course_id)
  );

CREATE POLICY "enrollments_mutate_super_admin"
  ON public.course_enrollments FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "enrollments_delete_super_admin"
  ON public.course_enrollments FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- threads
CREATE POLICY "threads_select_enrolled"
  ON public.course_threads FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_enrolled_in_course(auth.uid(), course_id)
  );

CREATE POLICY "threads_insert_enrolled"
  ON public.course_threads FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.user_enrolled_in_course(auth.uid(), course_id)
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "threads_update_own_or_super"
  ON public.course_threads FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (user_id = auth.uid() AND public.user_enrolled_in_course(auth.uid(), course_id))
  );

CREATE POLICY "threads_delete_own_or_super"
  ON public.course_threads FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

-- replies
CREATE POLICY "replies_select_enrolled"
  ON public.course_thread_replies FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_threads t
      WHERE t.id = course_thread_replies.thread_id
        AND (
          public.is_super_admin(auth.uid())
          OR public.user_enrolled_in_course(auth.uid(), t.course_id)
        )
    )
  );

CREATE POLICY "replies_insert_enrolled"
  ON public.course_thread_replies FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_threads t
      WHERE t.id = course_thread_replies.thread_id
        AND (
          public.user_enrolled_in_course(auth.uid(), t.course_id)
          OR public.is_super_admin(auth.uid())
        )
    )
  );

CREATE POLICY "replies_update_own_or_super"
  ON public.course_thread_replies FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "replies_delete_own_or_super"
  ON public.course_thread_replies FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

-- documents (visibility window)
CREATE POLICY "documents_select"
  ON public.course_documents FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      public.user_enrolled_in_course(auth.uid(), course_id)
      AND visible_from <= TIMEZONE('utc'::text, NOW())
      AND (visible_until IS NULL OR visible_until >= TIMEZONE('utc'::text, NOW()))
    )
  );

CREATE POLICY "documents_insert_super"
  ON public.course_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) AND uploaded_by = auth.uid());

CREATE POLICY "documents_update_super"
  ON public.course_documents FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "documents_delete_super"
  ON public.course_documents FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- notifications
CREATE POLICY "notifications_select_enrolled"
  ON public.course_notifications FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_enrolled_in_course(auth.uid(), course_id)
  );

CREATE POLICY "notifications_insert_super_admin"
  ON public.course_notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "notifications_update_super_admin"
  ON public.course_notifications FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "notifications_delete_super_admin"
  ON public.course_notifications FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- notification reads
CREATE POLICY "reads_select_own"
  ON public.course_notification_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "reads_insert_own"
  ON public.course_notification_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Storage for course files: path = {course_id}/{filename}
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-docs', 'course-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "course_docs_select_enrolled"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-docs'
    AND (
      public.is_super_admin(auth.uid())
      OR (split_part(name, '/', 1))::uuid IN (
        SELECT course_id FROM public.course_enrollments WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "course_docs_insert_super"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-docs'
    AND public.is_super_admin(auth.uid())
  );

CREATE POLICY "course_docs_update_super"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-docs' AND public.is_super_admin(auth.uid()));

CREATE POLICY "course_docs_delete_super"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-docs' AND public.is_super_admin(auth.uid()));
