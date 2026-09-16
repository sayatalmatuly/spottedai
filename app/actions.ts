'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { AttendanceStatus } from '@/lib/types';

export async function saveAttendance(
  classId: string,
  date: string,
  marks: { studentId: string; status: AttendanceStatus }[]
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Upsert attendance records
  const records = marks.map((mark) => ({
    student_id: mark.studentId,
    class_id: classId,
    date,
    status: mark.status,
    marked_by: user.id,
  }));

  const { error } = await supabase
    .from('attendance_logs')
    .upsert(records, { onConflict: 'student_id,date' });

  if (error) throw new Error(error.message);

  revalidatePath('/');
}
