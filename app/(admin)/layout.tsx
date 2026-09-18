import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/auth';
import { getCurrentLocale } from '@/lib/locale-server';
import { translate } from '@/lib/locale';
import { redirect } from 'next/navigation';
import AdminShell from './AdminShell';
import './admin.css';
import '../AttendanceDashboard.css';
import '../navigation.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const locale = await getCurrentLocale();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Keep the role check on the server as well as in middleware. This prevents
  // access if middleware is ever skipped by a deployment configuration.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  if (!isAdminRole(profile?.role)) {
    redirect('/');
  }

  return (
    <AdminShell
      userInfo={
        <div className="admin-user-name">
          {profile?.full_name || translate(locale, 'Әкімші', 'Administrator')}
          <br />
          <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>{profile?.role}</span>
        </div>
      }
    >
      {children}
    </AdminShell>
  );
}
