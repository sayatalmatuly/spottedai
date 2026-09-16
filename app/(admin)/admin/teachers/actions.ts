'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { UserRole } from '@/lib/types';

export async function assignTeacherToClass(teacherId: string, classId: string) {
  const supabase = await createClient();
  await supabase.from('classes').update({ teacher_id: teacherId }).eq('id', classId);
  revalidatePath('/admin/teachers');
}

export async function approveUserRequest(userId: string, role: UserRole) {
  const supabase = await createClient();
  await supabase
    .from('profiles')
    .update({ role, status: 'APPROVED' })
    .eq('id', userId);

  revalidatePath('/admin/teachers');
  revalidatePath('/');
}

export async function rejectUserRequest(userId: string) {
  const supabase = await createClient();
  await supabase
    .from('profiles')
    .update({ status: 'REJECTED' })
    .eq('id', userId);

  revalidatePath('/admin/teachers');
  revalidatePath('/');
}
