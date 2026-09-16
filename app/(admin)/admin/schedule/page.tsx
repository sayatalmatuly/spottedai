import { createClient } from '@/lib/supabase/server';
import ScheduleClient from './ScheduleClient';

export default async function SchedulePage() {
  const supabase = await createClient();
  
  const { data: schedule } = await supabase
    .from('schedule')
    .select(`*, class:classes(name), teacher:profiles(full_name)`)
    .order('day_of_week')
    .order('lesson_number');
    
  const { data: classes } = await supabase.from('classes').select('*').order('name');
  const { data: teachers } = await supabase.from('profiles').select('*').eq('role', 'TEACHER').order('full_name');

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">Расписание</h1>
      </div>
      <ScheduleClient 
        schedule={schedule || []} 
        classes={classes || []}
        teachers={teachers || []}
      />
    </div>
  );
}
