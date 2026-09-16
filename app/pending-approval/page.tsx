'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import './pending.css';

export default function PendingApprovalPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, status')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserName(profile.full_name);
        // If approved (or status column doesn't exist yet / is NULL / APPROVED), redirect to main
        if (!profile.status || profile.status === 'APPROVED') {
          router.push('/');
          router.refresh();
        }
      }
    }

    checkStatus();
  }, [router, supabase]);

  const handleRefresh = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single();

    if (profile && (!profile.status || profile.status === 'APPROVED')) {
      router.push('/');
      router.refresh();
    } else {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="pending-shell">
      <div className="pending-card">
        <div className="pending-icon">⏳</div>
        <h1>Заявка на рассмотрении</h1>
        <p>
          Здравствуйте, <b>{userName || 'пользователь'}</b>! Ваша заявка на регистрацию в электронном журнале принята. 
          Администратор школы должен подтвердить ваш аккаунт и назначить роль (Учитель или Администратор).
        </p>

        <div className="pending-actions">
          <button className="btn-check-status" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Проверка...' : 'Проверить статус'}
          </button>
          <button className="btn-pending-logout" onClick={handleSignOut}>
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}

