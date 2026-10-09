'use server';

import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/auth';
import { withArchiveSchemaFallback } from '@/lib/class-schema-compat';
import { revalidatePath } from 'next/cache';

export async function addClass(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get('name') as string;
  const { error } = await supabase.from('classes').insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/classes');
}

export async function deleteClass(classId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('classes').delete().eq('id', classId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/classes');
}

export async function addStudent(formData: FormData) {
  const supabase = await createClient();
  const fullName = formData.get('full_name') as string;
  const classId = formData.get('class_id') as string;
  const { error } = await supabase.from('students').insert({ full_name: fullName, class_id: classId });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/classes');
}

export async function deleteStudent(studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/classes');
}

export async function importFirstGradeStudents(rows: { className: string; fullName: string }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!isAdminRole(profile?.role)) throw new Error('Not authorized');
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 2000) {
    throw new Error('The import must contain between 1 and 2,000 rows');
  }

  const normalizedRows = rows.map((row) => ({
    className: typeof row?.className === 'string' ? row.className.trim() : '',
    fullName: typeof row?.fullName === 'string' ? row.fullName.trim() : '',
  }));
  if (normalizedRows.some((row) => !row.className || !row.fullName || row.fullName.length > 200)) {
    throw new Error('Each row must contain a class and a valid student name');
  }

  const classQuery = await withArchiveSchemaFallback(
    () => supabase
      .from('classes')
      .select('id, name')
      .eq('is_archived', false),
    () => supabase
      .from('classes')
      .select('id, name')
  );
  const { data: classes, error: classesError } = classQuery.result;
  if (classesError) throw new Error(classesError.message);

  const firstGradeByName = new Map(
    (classes || [])
      .filter((classInfo) => /^1(?:\D|$)/.test(classInfo.name))
      .map((classInfo) => [classInfo.name.toLocaleLowerCase(), classInfo.id])
  );
  const classIdByName = new Map<string, string>();
  for (const row of normalizedRows) {
    const classId = firstGradeByName.get(row.className.toLocaleLowerCase());
    if (!classId) throw new Error(`Unknown active first-grade class: ${row.className}`);
    classIdByName.set(row.className.toLocaleLowerCase(), classId);
  }

  const classIds = [...new Set(classIdByName.values())];
  const { data: existingStudents, error: studentsError } = await supabase
    .from('students')
    .select('class_id, full_name')
    .in('class_id', classIds);
  if (studentsError) throw new Error(studentsError.message);

  const existingKeys = new Set(
    (existingStudents || []).map((student) => `${student.class_id}:${student.full_name.trim().toLocaleLowerCase()}`)
  );
  const seenKeys = new Set<string>();
  const studentsToInsert = normalizedRows.flatMap((row) => {
    const classId = classIdByName.get(row.className.toLocaleLowerCase())!;
    const key = `${classId}:${row.fullName.toLocaleLowerCase()}`;
    if (existingKeys.has(key) || seenKeys.has(key)) return [];
    seenKeys.add(key);
    return [{ class_id: classId, full_name: row.fullName }];
  });

  if (studentsToInsert.length > 0) {
    const { error } = await supabase.from('students').insert(studentsToInsert);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/classes');
  revalidatePath('/');
  return { inserted: studentsToInsert.length, skipped: normalizedRows.length - studentsToInsert.length };
}
