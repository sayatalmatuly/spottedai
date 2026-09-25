import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ResetPasswordClient from './ResetPasswordClient';

export const dynamic = 'force-dynamic';

const PASSWORD_RECOVERY_COOKIE = 'spottedai_password_recovery';

export default async function ResetPasswordPage() {
  const hasRecoveryCookie = (await cookies()).get(PASSWORD_RECOVERY_COOKIE)?.value === '1';
  if (!hasRecoveryCookie) redirect('/login?reset=invalid');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?reset=invalid');

  return <ResetPasswordClient />;
}
