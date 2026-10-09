ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS academic_year_start INTEGER;

UPDATE public.classes
SET academic_year_start = CASE
  WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 9 THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
  ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1
END
WHERE academic_year_start IS NULL;

ALTER TABLE public.classes
  ALTER COLUMN academic_year_start SET NOT NULL,
  ALTER COLUMN academic_year_start SET DEFAULT (
    CASE
      WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 9 THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
      ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1
    END
  );

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS classes_year_name_key
  ON public.classes (academic_year_start, name);
CREATE INDEX IF NOT EXISTS idx_classes_active_year
  ON public.classes (academic_year_start, is_archived);

CREATE TABLE IF NOT EXISTS public.academic_year_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
  current_year_start INTEGER NOT NULL
);

ALTER TABLE public.academic_year_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.academic_year_state (singleton, current_year_start)
VALUES (
  true,
  CASE
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 9 THEN EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
    ELSE EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1
  END
)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.run_annual_class_rollover()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_start INTEGER;
  source_class RECORD;
  grade_number INTEGER;
  destination_class_id UUID;
  destination_name TEXT;
  transitions INTEGER := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  SELECT state.current_year_start
  INTO current_start
  FROM public.academic_year_state AS state
  WHERE state.singleton = true
  FOR UPDATE;

  IF current_start IS NULL THEN
    RAISE EXCEPTION 'Academic year state is not initialized';
  END IF;

  WHILE CURRENT_DATE >= make_date(current_start + 1, 9, 1) LOOP
    UPDATE public.classes
    SET is_archived = true
    WHERE academic_year_start = current_start
      AND is_archived = false;

    FOR source_class IN
      SELECT classes.id, classes.name, classes.teacher_id
      FROM public.classes AS classes
      WHERE classes.academic_year_start = current_start
        AND classes.name ~ '^(1[0]|[1-9])([^0-9].*)?$'
      ORDER BY classes.name
    LOOP
      grade_number := substring(source_class.name FROM '^([0-9]+)')::INTEGER;
      IF grade_number BETWEEN 1 AND 10 THEN
        destination_name := (grade_number + 1)::TEXT
          || substring(source_class.name FROM length(grade_number::TEXT) + 1);

        INSERT INTO public.classes (name, teacher_id, academic_year_start, is_archived)
        VALUES (destination_name, source_class.teacher_id, current_start + 1, false)
        RETURNING id INTO destination_class_id;

        UPDATE public.students
        SET class_id = destination_class_id
        WHERE class_id = source_class.id;
      END IF;
    END LOOP;

    FOR source_class IN
      SELECT classes.name, classes.teacher_id
      FROM public.classes AS classes
      WHERE classes.academic_year_start = current_start
        AND classes.name ~ '^1([^0-9].*)?$'
      ORDER BY classes.name
    LOOP
      INSERT INTO public.classes (name, teacher_id, academic_year_start, is_archived)
      VALUES (source_class.name, source_class.teacher_id, current_start + 1, false);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM public.classes
      WHERE academic_year_start = current_start + 1
        AND is_archived = false
        AND name ~ '^1([^0-9].*)?$'
    ) THEN
      INSERT INTO public.classes (name, academic_year_start, is_archived)
      VALUES ('1', current_start + 1, false);
    END IF;

    UPDATE public.academic_year_state
    SET current_year_start = current_start + 1
    WHERE singleton = true;

    current_start := current_start + 1;
    transitions := transitions + 1;
  END LOOP;

  RETURN transitions;
END;
$$;

REVOKE ALL ON FUNCTION public.run_annual_class_rollover() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_annual_class_rollover() TO service_role;

DROP POLICY IF EXISTS "Users can read assigned classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated users can read classes" ON public.classes;
CREATE POLICY "Users can read active assigned classes" ON public.classes
  FOR SELECT TO authenticated
  USING (public.is_admin() OR (teacher_id = auth.uid() AND is_archived = false));

DROP POLICY IF EXISTS "Users can read students in assigned classes" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can read students" ON public.students;
CREATE POLICY "Users can read students in active assigned classes" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.classes
      WHERE classes.id = students.class_id
        AND classes.teacher_id = auth.uid()
        AND classes.is_archived = false
    )
  );

DROP POLICY IF EXISTS "Users can read attendance in assigned classes" ON public.attendance_logs;
DROP POLICY IF EXISTS "Authenticated users can read attendance_logs" ON public.attendance_logs;
CREATE POLICY "Users can read attendance in active assigned classes" ON public.attendance_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.classes
      WHERE classes.id = attendance_logs.class_id
        AND classes.teacher_id = auth.uid()
        AND classes.is_archived = false
    )
  );

DROP POLICY IF EXISTS "Users can insert attendance in assigned classes" ON public.attendance_logs;
DROP POLICY IF EXISTS "Authenticated users can insert attendance_logs" ON public.attendance_logs;
CREATE POLICY "Users can insert attendance in active assigned classes" ON public.attendance_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      marked_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = attendance_logs.class_id
          AND classes.teacher_id = auth.uid()
          AND classes.is_archived = false
      )
      AND EXISTS (
        SELECT 1 FROM public.students
        WHERE students.id = attendance_logs.student_id
          AND students.class_id = attendance_logs.class_id
      )
    )
  );

DROP POLICY IF EXISTS "Users can update attendance in assigned classes" ON public.attendance_logs;
DROP POLICY IF EXISTS "Authenticated users can update attendance_logs" ON public.attendance_logs;
CREATE POLICY "Users can update attendance in active assigned classes" ON public.attendance_logs
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = attendance_logs.class_id
        AND classes.teacher_id = auth.uid()
        AND classes.is_archived = false
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      marked_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = attendance_logs.class_id
          AND classes.teacher_id = auth.uid()
          AND classes.is_archived = false
      )
      AND EXISTS (
        SELECT 1 FROM public.students
        WHERE students.id = attendance_logs.student_id
          AND students.class_id = attendance_logs.class_id
      )
    )
  );

NOTIFY pgrst, 'reload schema';