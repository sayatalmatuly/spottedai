import { createClient } from '@/lib/supabase/server';
import { sortClassesNaturally } from '@/lib/class-sort';
import { getCurrentLocale } from '@/lib/locale-server';
import { translate } from '@/lib/locale';
import ClassesClient from './ClassesClient';

export default async function ClassesPage() {
  const supabase = await createClient();
  const locale = await getCurrentLocale();
  
  const classesResult = await supabase
    .from('classes')
    .select('id, name, teacher_id, student_count, teacher:profiles(id, full_name)');

  const classes = sortClassesNaturally(
    (classesResult.data || []).map((classInfo: any) => ({
      ...classInfo,
      teacher: Array.isArray(classInfo.teacher) ? classInfo.teacher[0] || null : classInfo.teacher,
    }))
  );

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">{translate(locale, 'Сыныптар', 'Classes')}</h1>
      </div>
      <ClassesClient initialClasses={classes} />
    </div>
  );
}
