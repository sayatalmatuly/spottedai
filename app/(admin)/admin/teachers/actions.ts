'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminRole } from '@/lib/auth';
import { withArchiveSchemaFallback } from '@/lib/class-schema-compat';
import { revalidatePath } from 'next/cache';
import type { UserRole } from '@/lib/types';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!isAdminRole(profile?.role)) throw new Error('Not authorized');

  return { supabase, userId: user.id };
}

export async function assignTeacherToClass(teacherId: string, classId: string) {
  const { supabase } = await requireAdmin();
  const result = await withArchiveSchemaFallback(
    () => supabase
      .from('classes')
      .update({ teacher_id: teacherId })
      .eq('id', classId)
      .eq('is_archived', false),
    () => supabase
      .from('classes')
      .update({ teacher_id: teacherId })
      .eq('id', classId)
  );
  const { error } = result.result;
  if (error) throw new Error(error.message);
  revalidatePath('/admin/teachers');
}

export async function removeTeacherFromClass(teacherId: string, classId: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from('classes')
    .update({ teacher_id: null })
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || 'Class assignment not found');

  revalidatePath('/admin/teachers');
  revalidatePath('/');
}

export async function deleteUserAccount(userId: string) {
  const { userId: adminId } = await requireAdmin();
  if (!userId || userId === adminId) throw new Error('Cannot delete this account');

  const admin = createAdminClient();
  const { data: targetProfile, error: profileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!targetProfile) throw new Error('User not found');

  if (isAdminRole(targetProfile.role)) {
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'ADMIN');
    if (error) throw new Error(error.message);
    if ((count || 0) <= 1) throw new Error('Cannot delete the last administrator');
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/teachers');
  revalidatePath('/admin/schedule');
  revalidatePath('/');
}

export async function approveUserRequest(userId: string, role: UserRole) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role, status: 'APPROVED' })
    .eq('id', userId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/teachers');
  revalidatePath('/');
}

export async function rejectUserRequest(userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'REJECTED' })
    .eq('id', userId);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/teachers');
  revalidatePath('/');
}
