import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminShell from './AdminShell';
import AdminUserInfo from './AdminUserInfo';
import { AdminUserInfoSkeleton } from '@/app/components/RouteLoading';
import './admin.css';
import '../AttendanceDashboard.css';
import '../navigation.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
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
    .select('role')
    .eq('id', user.id)
    .single();

  if (!isAdminRole(profile?.role)) {
    redirect('/');
  }

  return (
    <AdminShell
      userInfo={
        <Suspense fallback={<AdminUserInfoSkeleton />}>
          <AdminUserInfo userId={user.id} />
        </Suspense>
      }
    >
      {children}
    </AdminShell>
  );
}
