'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addScheduleEntry(formData: FormData) {
  const supabase = await createClient();
  await supabase.from('schedule').insert({
    class_id: formData.get('class_id') as string,
    day_of_week: Number(formData.get('day_of_week')),
    lesson_number: Number(formData.get('lesson_number')),
    subject: formData.get('subject') as string,
    teacher_id: formData.get('teacher_id') as string,
  });
  revalidatePath('/admin/schedule');
}

export async function deleteScheduleEntry(entryId: string) {
  const supabase = await createClient();
  await supabase.from('schedule').delete().eq('id', entryId);
  revalidatePath('/admin/schedule');
}
