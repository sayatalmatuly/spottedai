'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
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
