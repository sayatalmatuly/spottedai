'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { translate } from '@/lib/locale';
import { useLanguage } from '@/app/components/LanguageProvider';
import './pending.css';

export default function PendingApprovalPage() {
  const { locale } = useLanguage();
  const t = (kazakh: string, english: string) => translate(locale, kazakh, english);
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
        <h1>{t('Өтінім қарастырылуда', 'Request under review')}</h1>
        <p>
          {t('Сәлеметсіз бе, ', 'Hello, ')}<b>{userName || t('пайдаланушы', 'user')}</b>! {t('Электрондық журналға тіркелу өтініміңіз қабылданды. Мектеп әкімшісі аккаунтыңызды растап, рөліңізді (мұғалім немесе әкімші) тағайындауы керек.', 'Your registration request for the digital journal has been received. A school administrator needs to approve your account and assign a role (Teacher or Administrator).')}
        </p>

        <div className="pending-actions">
          <button className="btn-check-status" onClick={handleRefresh} disabled={loading}>
            {loading ? t('Тексерілуде...', 'Checking...') : t('Күйін тексеру', 'Check status')}
          </button>
          <button className="btn-pending-logout" onClick={handleSignOut}>
            {t('Аккаунттан шығу', 'Sign out')}
          </button>
        </div>
      </div>
    </div>
  );
}
