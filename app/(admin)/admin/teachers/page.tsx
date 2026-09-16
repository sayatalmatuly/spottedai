import { createClient } from '@/lib/supabase/server';
import TeachersClient from './TeachersClient';
import type { Profile } from '@/lib/types';

export default async function TeachersPage() {
  const supabase = await createClient();
  
  const [profilesResult, classesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, status, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('classes')
      .select('id, name, teacher_id, student_count')
      .order('name'),
  ]);

  const allProfiles: Profile[] = profilesResult.data || [];
  const pendingUsers = allProfiles.filter(p => p.status === 'PENDING');
  // Profiles that are APPROVED or don't have status field set yet
  const activeUsers = allProfiles.filter(p => p.status === 'APPROVED' || !p.status);

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">Пользователи и классы</h1>
      </div>
      <TeachersClient 
        pendingUsers={pendingUsers}
        activeUsers={activeUsers} 
        classes={classesResult.data || []}
      />
    </div>
  );
}
