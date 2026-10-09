'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isAdminRole } from '@/lib/auth';
import { withArchiveSchemaFallback } from '@/lib/class-schema-compat';
import type { AbsenceReason, AttendanceStatus } from '@/lib/types';

const ABSENCE_REASONS: AbsenceReason[] = ['sick', 'excused', 'valid', 'unexcused'];

export async function saveAttendance(
  classId: string,
  date: string,
  marks: { studentId: string; status: AttendanceStatus; absenceReason?: AbsenceReason | null }[]
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();
  const isAdmin = isAdminRole(profile?.role);
  if (
    (!isAdmin && profile?.role !== 'TEACHER')
    || profile?.status === 'PENDING'
    || profile?.status === 'REJECTED'
  ) {
    throw new Error('Not authorized');
  }

  const classQuery = await withArchiveSchemaFallback(
    () => supabase
      .from('classes')
      .select('id, teacher_id, is_archived')
      .eq('id', classId)
      .maybeSingle(),
    () => supabase
      .from('classes')
      .select('id, teacher_id')
      .eq('id', classId)
      .maybeSingle()
  );
  const classInfo = classQuery.result.data;
  if (
    !classInfo
    || Boolean((classInfo as { is_archived?: boolean }).is_archived)
    || (!isAdmin && classInfo.teacher_id !== user.id)
  ) {
    throw new Error('Not authorized for this class');
  }

  if (!Array.isArray(marks) || marks.some((mark) => !mark || typeof mark.studentId !== 'string')) {
    throw new Error('Invalid attendance marks');
  }
  const studentIds = [...new Set(marks.map((mark) => mark.studentId))];
  if (studentIds.length !== marks.length) {
    throw new Error('Duplicate attendance marks');
  }
  if (studentIds.length > 0) {
    const { data: classStudents, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId)
      .in('id', studentIds);
    if (studentsError || classStudents?.length !== studentIds.length) {
      throw new Error('Attendance marks contain students outside this class');
    }
  }

  // Upsert attendance records
  const records = marks.map((mark) => {
    const absenceReason = mark.status === 'absent'
      ? (mark.absenceReason || 'unexcused')
      : null;

    if (absenceReason && !ABSENCE_REASONS.includes(absenceReason)) {
      throw new Error('Некорректная причина отсутствия');
    }

    return {
      student_id: mark.studentId,
      class_id: classId,
      date,
      status: mark.status,
      absence_reason: absenceReason,
      marked_by: user.id,
    };
  });

  const { error } = await supabase
    .from('attendance_logs')
    .upsert(records, { onConflict: 'student_id,date' });

  if (error) throw new Error(error.message);

  revalidatePath('/');
}
