import { createClient } from '@/lib/supabase/server';
import ClassesClient from './ClassesClient';

export default async function ClassesPage() {
  const supabase = await createClient();
  
  const [classesResult, studentsResult] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, teacher_id, teacher:profiles(id, full_name)')
      .order('name'),
    supabase
      .from('students')
      .select('id, full_name, class_id')
      .order('full_name'),
  ]);
  const classes = (classesResult.data || []).map((classInfo: any) => ({
    ...classInfo,
    teacher: Array.isArray(classInfo.teacher) ? classInfo.teacher[0] || null : classInfo.teacher,
  }));

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">Классы</h1>
      </div>
      <ClassesClient 
        initialClasses={classes}
        allStudents={studentsResult.data || []}
      />
    </div>
  );
}
