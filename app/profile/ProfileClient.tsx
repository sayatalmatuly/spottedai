'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateProfileName } from './actions';
import type { Profile } from '@/lib/types';
import { dateLocale, translate } from '@/lib/locale';
import { useLanguage } from '@/app/components/LanguageProvider';
import './profile.css';

interface ProfileClientProps {
  profile: Profile | null;
  userEmail: string;
}

export default function ProfileClient({ profile, userEmail }: ProfileClientProps) {
  const { locale } = useLanguage();
  const t = (kazakh: string, english: string) => translate(locale, kazakh, english);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const initials = fullName
    ? fullName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : t('М', 'T');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await updateProfileName(fullName);
      setMessage({ text: t('Профиль сәтті жаңартылды!', 'Profile updated successfully!'), type: 'success' });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: t('Профильді жаңарту мүмкін болмады', 'Could not update the profile'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="profile-shell">
      <div className="profile-container">
        <div className="profile-header">
          <Link href="/" prefetch className="profile-back">
            ← {t('Журналға оралу', 'Back to Journal')}
          </Link>
          {profile?.role === 'ADMIN' && (
            <Link href="/admin/teachers" prefetch className="profile-back">
              {t('Әкімші панелі', 'Admin panel')} →
            </Link>
          )}
        </div>

        <div className="profile-card">
          <div className="profile-avatar-large">{initials}</div>
          <h1 className="profile-name">{fullName || t('Мұғалім', 'Teacher')}</h1>
          <span
            className={`profile-role-badge ${
              profile?.role === 'ADMIN' ? 'admin' : 'teacher'
            }`}
          >
            {profile?.role === 'ADMIN' ? t('Әкімші', 'Administrator') : t('Мұғалім', 'Teacher')}
          </span>

          {message && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13.5px',
                marginBottom: '16px',
                background:
                  message.type === 'success'
                    ? 'rgba(48, 209, 88, 0.14)'
                    : 'rgba(255, 69, 58, 0.14)',
                color: message.type === 'success' ? '#28cd41' : '#FF453A',
              }}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="profile-field">
              <label>{t('Аты-жөні', 'Full name')}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('Айдана Серікқызы', 'Jane Doe')}
                required
              />
            </div>

            <div className="profile-field">
              <label>Email ({t('логин', 'sign-in')})</label>
              <input type="email" value={userEmail} disabled style={{ opacity: 0.7 }} />
            </div>

            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span>{t('Жүйедегі рөлі', 'Role in the system')}</span>
                <strong>{profile?.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}</strong>
              </div>
              <div className="profile-info-item">
                <span>{t('Жасалған күні', 'Created on')}</span>
                <strong>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString(dateLocale(locale))
                    : '—'}
                </strong>
              </div>
            </div>

            <div className="profile-actions">
              <button
                type="button"
                className="btn-logout"
                onClick={handleSignOut}
              >
                {t('Аккаунттан шығу', 'Sign out')}
              </button>
              <button
                type="submit"
                className="btn-save-profile"
                disabled={loading}
              >
                {loading ? t('Сақталуда...', 'Saving...') : t('Өзгерістерді сақтау', 'Save changes')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
