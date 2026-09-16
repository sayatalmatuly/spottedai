-- ============================================
-- SpottedAI — Supabase Migration Script
-- ============================================

-- 1. Custom types
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'TEACHER');
CREATE TYPE public.user_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent');

-- 2. Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'TEACHER',
  status public.user_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup with PENDING status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'TEACHER'),
    COALESCE((NEW.raw_user_meta_data->>'status')::public.user_status, 'PENDING')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Classes table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  student_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to update student_count on classes
CREATE OR REPLACE FUNCTION public.update_student_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.classes SET student_count = student_count + 1 WHERE id = NEW.class_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.classes SET student_count = student_count - 1 WHERE id = OLD.class_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.class_id <> OLD.class_id THEN
    UPDATE public.classes SET student_count = student_count - 1 WHERE id = OLD.class_id;
    UPDATE public.classes SET student_count = student_count + 1 WHERE id = NEW.class_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_student_change
  AFTER INSERT OR DELETE OR UPDATE OF class_id ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.update_student_count();

-- 5. Schedule table
CREATE TABLE public.schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  lesson_number INT NOT NULL CHECK (lesson_number BETWEEN 1 AND 8),
  subject TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE (class_id, day_of_week, lesson_number)
);

-- 6. Attendance logs table
CREATE TABLE public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles
CREATE POLICY "Authenticated users can read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());

-- classes
CREATE POLICY "Authenticated users can read classes" ON public.classes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert classes" ON public.classes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update classes" ON public.classes
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete classes" ON public.classes
  FOR DELETE TO authenticated USING (public.is_admin());

-- students
CREATE POLICY "Authenticated users can read students" ON public.students
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert students" ON public.students
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update students" ON public.students
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete students" ON public.students
  FOR DELETE TO authenticated USING (public.is_admin());

-- schedule
CREATE POLICY "Authenticated users can read schedule" ON public.schedule
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert schedule" ON public.schedule
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update schedule" ON public.schedule
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete schedule" ON public.schedule
  FOR DELETE TO authenticated USING (public.is_admin());

-- attendance_logs
CREATE POLICY "Authenticated users can read attendance_logs" ON public.attendance_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert attendance_logs" ON public.attendance_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update attendance_logs" ON public.attendance_logs
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete attendance_logs" ON public.attendance_logs
  FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_students_class_id ON public.students(class_id);
CREATE INDEX idx_attendance_logs_date ON public.attendance_logs(date);
CREATE INDEX idx_attendance_logs_class_date ON public.attendance_logs(class_id, date);
CREATE INDEX idx_attendance_logs_student_date ON public.attendance_logs(student_id, date);
CREATE INDEX idx_schedule_class_day ON public.schedule(class_id, day_of_week);
