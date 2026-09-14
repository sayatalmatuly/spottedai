'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateProfileName } from './actions';
import type { Profile } from '@/lib/types';
import './profile.css';

interface ProfileClientProps {
  profile: Profile | null;
  userEmail: string;
}

export default function ProfileClient({ profile, userEmail }: ProfileClientProps) {
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
    : 'У';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await updateProfileName(fullName);
      setMessage({ text: 'Профиль успешно обновлён!', type: 'success' });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message || 'Ошибка обновления', type: 'error' });
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
            ← Вернуться в Журнал
          </Link>
          {profile?.role === 'ADMIN' && (
            <Link href="/admin/teachers" prefetch className="profile-back">
              Админ-панель →
            </Link>
          )}
        </div>

        <div className="profile-card">
          <div className="profile-avatar-large">{initials}</div>
          <h1 className="profile-name">{fullName || 'Учитель'}</h1>
          <span
            className={`profile-role-badge ${
              profile?.role === 'ADMIN' ? 'admin' : 'teacher'
            }`}
          >
            {profile?.role === 'ADMIN' ? 'Администратор' : 'Учитель'}
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
              <label>ФИО</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иванова Ольга Сергеевна"
                required
              />
            </div>

            <div className="profile-field">
              <label>Email (логин)</label>
              <input type="email" value={userEmail} disabled style={{ opacity: 0.7 }} />
            </div>

            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span>Роль в системе</span>
                <strong>{profile?.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}</strong>
              </div>
              <div className="profile-info-item">
                <span>Дата создания</span>
                <strong>
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString('ru-RU')
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
                Выйти из аккаунта
              </button>
              <button
                type="submit"
                className="btn-save-profile"
                disabled={loading}
              >
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

