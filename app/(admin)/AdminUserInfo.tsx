import { createClient } from '@/lib/supabase/server';

export default async function AdminUserInfo({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) return null;

  return (
    <div className="admin-user-name">
      {profile.full_name}
      <br />
      <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>{profile.role}</span>
    </div>
  );
}
