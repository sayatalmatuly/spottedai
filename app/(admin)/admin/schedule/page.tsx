import { createClient } from '@/lib/supabase/server';
import { sortClassesNaturally } from '@/lib/class-sort';
import { getCurrentLocale } from '@/lib/locale-server';
import { translate } from '@/lib/locale';
import ScheduleClient from './ScheduleClient';

export default async function SchedulePage() {
  const supabase = await createClient();
  const locale = await getCurrentLocale();
  
  const [scheduleResult, classesResult, teachersResult] = await Promise.all([
    supabase
      .from('schedule')
      .select('id, class_id, day_of_week, lesson_number, subject, teacher_id, class:classes(name), teacher:profiles(full_name)')
      .order('day_of_week')
      .order('lesson_number'),
    supabase
      .from('classes')
      .select('id, name, teacher_id, student_count'),
    supabase
      .from('profiles')
      .select('id, full_name, role, status, created_at')
      .eq('role', 'TEACHER')
      .order('full_name'),
  ]);

  const classes = sortClassesNaturally(classesResult.data || []);

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">{translate(locale, 'Кесте', 'Schedule')}</h1>
      </div>
      <ScheduleClient 
        schedule={scheduleResult.data || []}
        classes={classes}
        teachers={teachersResult.data || []}
      />
    </div>
  );
}
