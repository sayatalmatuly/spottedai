'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { translate } from '@/lib/locale';
import { useLanguage } from '../components/LanguageProvider';
import '../navigation.css';

export default function AdminShell({
  userInfo,
  children,
}: {
  userInfo: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const supabase = useMemo(() => createClient(), []);
  const { locale } = useLanguage();
  const t = (kazakh: string, english: string) => translate(locale, kazakh, english);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    startTransition(() => {
      router.push('/login');
    });
  };

  const navItems = [
    { href: '/admin/teachers', label: t('Мұғалімдер', 'Teachers') },
    { href: '/admin/classes', label: t('Сыныптар', 'Classes') },
    { href: '/admin/schedule', label: t('Кесте', 'Schedule') },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Journal</div>
        <nav className="admin-nav">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`admin-nav-item ${isActive ? 'active' : ''} ${isPending && !isActive ? 'pending' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-user-info">
          {userInfo}
          <Link href="/" prefetch className="admin-dashboard-link">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M3 11.5 12 4l9 7.5v8a.5.5 0 0 1-.5.5h-4.75v-5.75h-7.5V20H3.5a.5.5 0 0 1-.5-.5v-8Z" />
            </svg>
            <span>{t('Басқару тақтасы', 'Dashboard')}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="admin-btn admin-btn-secondary"
          >
            {t('Шығу', 'Sign out')}
          </button>
        </div>
      </aside>
      <main className="admin-main admin-main-content">{children}</main>
    </div>
  );
}
