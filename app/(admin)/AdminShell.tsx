'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    startTransition(() => {
      router.push('/login');
    });
  };

  const navItems = [
    { href: '/admin/teachers', label: 'Учителя' },
    { href: '/admin/classes', label: 'Классы' },
    { href: '/admin/schedule', label: 'Расписание' },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Журнал</div>
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
          <button
            onClick={handleLogout}
            className="admin-btn admin-btn-secondary"
            style={{ width: '100%', marginTop: '8px' }}
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="admin-main admin-main-content">{children}</main>
    </div>
  );
}
