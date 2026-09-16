'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function addClass(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get('name') as string;
  await supabase.from('classes').insert({ name });
  revalidatePath('/admin/classes');
}

export async function deleteClass(classId: string) {
  const supabase = await createClient();
  await supabase.from('classes').delete().eq('id', classId);
  revalidatePath('/admin/classes');
}

export async function addStudent(formData: FormData) {
  const supabase = await createClient();
  const fullName = formData.get('full_name') as string;
  const classId = formData.get('class_id') as string;
  await supabase.from('students').insert({ full_name: fullName, class_id: classId });
  revalidatePath('/admin/classes');
}

export async function deleteStudent(studentId: string) {
  const supabase = await createClient();
  await supabase.from('students').delete().eq('id', studentId);
  revalidatePath('/admin/classes');
}
