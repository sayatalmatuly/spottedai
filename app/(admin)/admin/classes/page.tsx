import { createClient } from '@/lib/supabase/server';
import { sortClassesNaturally } from '@/lib/class-sort';
import { getCurrentLocale } from '@/lib/locale-server';
import { translate } from '@/lib/locale';
import { runAnnualClassRolloverIfDue } from '@/lib/annual-class-rollover';
import { withArchiveSchemaFallback } from '@/lib/class-schema-compat';
import ClassesClient from './ClassesClient';

export default async function ClassesPage() {
  await runAnnualClassRolloverIfDue();
  const supabase = await createClient();
  const locale = await getCurrentLocale();
  
  const { result: classesResult, archiveSchemaAvailable } = await withArchiveSchemaFallback(
    () => supabase
      .from('classes')
      .select('id, name, teacher_id, student_count, academic_year_start, teacher:profiles(id, full_name)')
      .eq('is_archived', false),
    () => supabase
      .from('classes')
      .select('id, name, teacher_id, student_count, teacher:profiles(id, full_name)')
  );
  const archivedClassesResult = archiveSchemaAvailable
    ? await supabase
        .from('classes')
        .select('id, name, teacher_id, student_count, academic_year_start, teacher:profiles(id, full_name)')
        .eq('is_archived', true)
        .order('academic_year_start', { ascending: false })
    : { data: [] };

  const normalizeClasses = (rows: any[] | null) => sortClassesNaturally(
    (rows || []).map((classInfo: any) => ({
      ...classInfo,
      teacher: Array.isArray(classInfo.teacher) ? classInfo.teacher[0] || null : classInfo.teacher,
    }))
  );
  const classes = normalizeClasses(classesResult.data);
  const archivedClasses = normalizeClasses(archivedClassesResult.data);

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">{translate(locale, 'Сыныптар', 'Classes')}</h1>
      </div>
      <ClassesClient initialClasses={classes} archivedClasses={archivedClasses} />
    </div>
  );
}
