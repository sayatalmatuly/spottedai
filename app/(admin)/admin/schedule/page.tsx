import { createClient } from '@/lib/supabase/server';
import { sortClassesNaturally } from '@/lib/class-sort';
import { getCurrentLocale } from '@/lib/locale-server';
import { translate } from '@/lib/locale';
import { withArchiveSchemaFallback } from '@/lib/class-schema-compat';
import ScheduleClient from './ScheduleClient';

export default async function SchedulePage() {
  const supabase = await createClient();
  const locale = await getCurrentLocale();
  
  const [scheduleResult, classesQuery, teachersResult] = await Promise.all([
    supabase
      .from('schedule')
      .select('id, class_id, day_of_week, lesson_number, subject, teacher_id, class:classes(name), teacher:profiles(full_name)')
      .order('day_of_week')
      .order('lesson_number'),
    withArchiveSchemaFallback(
      () => supabase
      .from('classes')
      .select('id, name, teacher_id, student_count')
        .eq('is_archived', false),
      () => supabase
        .from('classes')
        .select('id, name, teacher_id, student_count')
    ),
    supabase
      .from('profiles')
      .select('id, full_name, role, status, created_at')
      .eq('role', 'TEACHER')
      .order('full_name'),
  ]);

  const classes = sortClassesNaturally(classesQuery.result.data || []);
  const activeClassIds = new Set(classes.map((classInfo) => classInfo.id));

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">{translate(locale, 'Кесте', 'Schedule')}</h1>
      </div>
      <ScheduleClient 
        schedule={(scheduleResult.data || []).filter((entry) => activeClassIds.has(entry.class_id))}
        classes={classes}
        teachers={teachersResult.data || []}
      />
    </div>
  );
}
