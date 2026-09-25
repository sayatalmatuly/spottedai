'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate } from '@/lib/locale';
import { useLanguage } from '@/app/components/LanguageProvider';
import { completePasswordReset } from './actions';
import '../login/login.css';

export default function ResetPasswordClient() {
  const { locale } = useLanguage();
  const t = (kazakh: string, english: string, russian?: string) => translate(locale, kazakh, english, russian);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      const result = await completePasswordReset({ password, confirmation, locale });
      if (result.error) {
        setMessage({ type: 'error', text: result.error });
        return;
      }

      setMessage({
        type: 'success',
        text: result.success || t('Құпиясөз жаңартылды.', 'Password updated.', 'Пароль обновлён.'),
      });
      setPassword('');
      setConfirmation('');
      window.setTimeout(() => router.replace('/login'), 1300);
    } catch (error) {
      console.error(error);
      setMessage({
        type: 'error',
        text: t(
          'Құпиясөзді жаңарту мүмкін болмады. Қайталап көріңіз.',
          'Could not update the password. Please try again.',
          'Не удалось обновить пароль. Попробуйте ещё раз.'
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="login-shell password-reset-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-glyph">↺</div>
        <h1>{t('Жаңа құпиясөз', 'New password', 'Новый пароль')}</h1>
        <p className="login-sub">
          {t(
            'Қауіпсіз жаңа құпиясөз орнатыңыз.',
            'Set a secure new password for your account.',
            'Установите новый пароль для учётной записи.'
          )}
        </p>

        {message && (
          <div className={message.type === 'error' ? 'login-error' : 'login-success'}>
            {message.text}
          </div>
        )}

        <label>
          <span>{t('Жаңа құпиясөз', 'New password', 'Новый пароль')}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={6}
            maxLength={128}
            required
            autoFocus
          />
        </label>

        <label>
          <span>{t('Құпиясөзді қайталаңыз', 'Confirm password', 'Повторите пароль')}</span>
          <input
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={6}
            maxLength={128}
            required
          />
        </label>

        <button type="submit" className="login-btn" disabled={isSaving}>
          {isSaving
            ? t('Сақталуда...', 'Saving...', 'Сохранение...')
            : t('Құпиясөзді жаңарту', 'Update password', 'Обновить пароль')}
        </button>
      </form>
    </main>
  );
}
