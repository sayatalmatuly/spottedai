-- Run this once in the Supabase SQL Editor for existing projects.
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS absence_reason TEXT
  CHECK (absence_reason IN ('sick', 'excused', 'valid', 'unexcused'));
