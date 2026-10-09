-- Teachers can only read classes assigned to them and students in those classes.
DROP POLICY IF EXISTS "Authenticated users can read classes" ON public.classes;
CREATE POLICY "Users can read assigned classes" ON public.classes
  FOR SELECT TO authenticated
  USING (public.is_admin() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can read students" ON public.students;
CREATE POLICY "Users can read students in assigned classes" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.classes
      WHERE classes.id = students.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read attendance_logs" ON public.attendance_logs;
CREATE POLICY "Users can read attendance in assigned classes" ON public.attendance_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.classes
      WHERE classes.id = attendance_logs.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert attendance_logs" ON public.attendance_logs;
CREATE POLICY "Users can insert attendance in assigned classes" ON public.attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      marked_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.classes
        WHERE classes.id = attendance_logs.class_id
          AND classes.teacher_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1
        FROM public.students
        WHERE students.id = attendance_logs.student_id
          AND students.class_id = attendance_logs.class_id
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update attendance_logs" ON public.attendance_logs;
CREATE POLICY "Users can update attendance in assigned classes" ON public.attendance_logs
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.classes
      WHERE classes.id = attendance_logs.class_id
        AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      marked_by = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.classes
        WHERE classes.id = attendance_logs.class_id
          AND classes.teacher_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1
        FROM public.students
        WHERE students.id = attendance_logs.student_id
          AND students.class_id = attendance_logs.class_id
      )
    )
  );

NOTIFY pgrst, 'reload schema';