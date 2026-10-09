import { createClient } from '@/lib/supabase/server';
import { sortClassesNaturally } from '@/lib/class-sort';
import { getCurrentLocale } from '@/lib/locale-server';
import { translate } from '@/lib/locale';
import { withArchiveSchemaFallback } from '@/lib/class-schema-compat';
import TeachersClient from './TeachersClient';
import type { Profile } from '@/lib/types';

export default async function TeachersPage() {
  const supabase = await createClient();
  const locale = await getCurrentLocale();
  
  const [profilesResult, classesQuery] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, status, created_at')
      .order('created_at', { ascending: false }),
    withArchiveSchemaFallback(
      () => supabase
      .from('classes')
      .select('id, name, teacher_id, student_count')
        .eq('is_archived', false),
      () => supabase
        .from('classes')
        .select('id, name, teacher_id, student_count')
    ),
  ]);

  const allProfiles: Profile[] = profilesResult.data || [];
  const classes = sortClassesNaturally(classesQuery.result.data || []);
  const pendingUsers = allProfiles.filter(p => p.status === 'PENDING');
  // Profiles that are APPROVED or don't have status field set yet
  const activeUsers = allProfiles.filter(p => p.status === 'APPROVED' || !p.status);

  return (
    <div>
      <div className="admin-header">
        <h1 className="admin-title">{translate(locale, 'Пайдаланушылар мен сыныптар', 'Users and classes')}</h1>
      </div>
      <TeachersClient 
        pendingUsers={pendingUsers}
        activeUsers={activeUsers} 
        classes={classes}
      />
    </div>
  );
}
