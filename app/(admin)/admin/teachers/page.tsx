import { createClient } from '@/lib/supabase/server';
import TeachersClient from './TeachersClient';
import type { Profile } from '@/lib/types';

export default async function TeachersPage() {
  const supabase = await createClient();
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .order('name');

  const allProfiles: Profile[] = profiles || [];
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
        classes={classes || []} 
      />
    </div>
  );
}
