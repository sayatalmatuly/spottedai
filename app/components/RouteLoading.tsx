'use client';

import '../navigation.css';
import { translate } from '@/lib/locale';
import { useLanguage } from './LanguageProvider';

export function LoadingSpinner({ label }: { label?: string }) {
  const { locale } = useLanguage();
  const accessibleLabel = label || translate(locale, 'Жүктелуде', 'Loading');

  return (
    <span className="loading-spinner" role="status" aria-label={accessibleLabel}>
      <span className="loading-spinner-ring" aria-hidden="true" />
    </span>
  );
}

export function AdminPageLoading() {
  const { locale } = useLanguage();
  const label = translate(locale, 'Жүктелуде', 'Loading');

  return (
    <div className="route-loading admin-route-loading" aria-busy="true" aria-label={label}>
      <LoadingSpinner />
      <div className="route-loading-header skeleton-block" />
      <div className="route-loading-card skeleton-block" />
      <div className="route-loading-card skeleton-block short" />
    </div>
  );
}

export function DashboardPageLoading() {
  const { locale } = useLanguage();
  const label = translate(locale, 'Жүктелуде', 'Loading');

  return (
    <div className="route-loading dashboard-route-loading shell" aria-busy="true" aria-label={label}>
      <div className="route-loading-spinner"><LoadingSpinner /></div>
      <aside className="sidebar">
        <div className="skeleton-block" style={{ height: 48, marginBottom: 24 }} />
        <div className="skeleton-block" style={{ height: 14, width: '40%', marginBottom: 12 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ height: 36, marginBottom: 6 }} />
        ))}
      </aside>
      <main className="main">
        <div className="skeleton-block" style={{ height: 32, width: '30%', marginBottom: 24 }} />
        <div className="skeleton-block" style={{ height: 200, marginBottom: 16, borderRadius: 22 }} />
        <div className="route-loading-stat-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-block" style={{ height: 88, borderRadius: 16 }} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function ProfilePageLoading() {
  const { locale } = useLanguage();
  const label = translate(locale, 'Жүктелуде', 'Loading');

  return (
    <div className="route-loading profile-route-loading" aria-busy="true" aria-label={label}>
      <LoadingSpinner />
      <div className="skeleton-block" style={{ height: 20, width: 160, marginBottom: 24 }} />
      <div className="route-loading-profile-card skeleton-block" />
    </div>
  );
}

export function AdminUserInfoSkeleton() {
  return (
    <div className="admin-user-name" aria-busy="true">
      <div className="skeleton-block" style={{ height: 14, width: '80%', marginBottom: 6 }} />
      <div className="skeleton-block" style={{ height: 12, width: '50%' }} />
    </div>
  );
}
