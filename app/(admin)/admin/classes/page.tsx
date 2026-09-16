import { createClient } from '@/lib/supabase/server';
import ClassesClient from './ClassesClient';

export default async function ClassesPage() {
  const supabase = await createClient();
  
  const { data: classes } = await supabase
    .from('classes')
    .select(`*, teacher:profiles(id, full_name)`)
    .order('name');
    
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .order('full_name');

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">Классы</h1>
      </div>
      <ClassesClient 
        initialClasses={classes || []} 
        allStudents={students || []} 
      />
    </div>
  );
}
