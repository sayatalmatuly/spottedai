'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { requestTeacherRegistration } from './actions';
import { translate } from '@/lib/locale';
import { useLanguage } from '@/app/components/LanguageProvider';
import './login.css';

export default function LoginPage() {
  const { locale } = useLanguage();
  const t = (kazakh: string, english: string) => translate(locale, kazakh, english);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (mode === 'login') {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(
          error.message === 'Invalid login credentials'
            ? t('Email немесе құпиясөз қате', 'Incorrect email or password')
            : error.message
        );
        setLoading(false);
        return;
      }

      // Проверяем статус профиля до того, как пустить пользователя дальше.
      // Пользователи со статусом PENDING (кроме админов) не должны попадать
      // в приложение — сразу разлогиниваем их и показываем причину.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', signInData.user.id)
        .single();

      const isAdmin = profile?.role === 'ADMIN';

      if (profile && profile.status === 'PENDING' && !isAdmin) {
        await supabase.auth.signOut();
        setError(t('Аккаунтыңызды әкімші әлі мақұлдаған жоқ. Расталуын күтіңіз.', 'Your account has not been approved by an administrator yet.'));
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } else {
      let result;
      try {
        result = await requestTeacherRegistration({ fullName, email, password, locale });
      } catch (registrationError) {
        console.error(registrationError);
        setError(t('Өтінімді жіберу мүмкін болмады. Қайталап көріңіз.', 'Could not send the request. Please try again.'));
        setLoading(false);
        return;
      }

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      if (result.sessionCreated) {
        router.push('/pending-approval');
        router.refresh();
      } else {
        setMode('login');
        setPassword('');
        setSuccess(
          result.notificationSent
            ? t('Өтінім әкімшіге жіберілді. Расталғаннан кейін кіре аласыз.', 'Your request was sent to the administrator. You can sign in once it is approved.')
            : t('Өтінім жасалды, бірақ әкімшіге хабарландыру жіберілмеді. Өтінім туралы хабарлаңыз.', 'Your request was created, but the administrator was not notified. Please let them know about it.')
        );
        setLoading(false);
      }
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-glyph">{t('Ж', 'J')}</div>
        <h1>{t('Журнал', 'Journal')}</h1>
        <p className="login-sub">{t('Электрондық қатысу журналы', 'Digital attendance journal')}</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccess(null);
            }}
          >
            {t('Кіру', 'Sign in')}
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setError(null);
              setSuccess(null);
            }}
          >
            {t('Тіркелу', 'Register')}
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        {mode === 'signup' && (
          <label>
            <span>{t('Аты-жөні', 'Full name')}</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('Айдана Серікқызы', 'Jane Doe')}
              required
            />
          </label>
        )}

        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@school14.kz"
            required
            autoFocus
          />
        </label>

        <label>
          <span>{t('Құпиясөз', 'Password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </label>

        <button type="submit" className="login-btn" disabled={loading}>
          {loading
            ? mode === 'login'
              ? t('Кіру...', 'Signing in...')
              : t('Тіркелу...', 'Registering...')
            : mode === 'login'
            ? t('Кіру', 'Sign in')
            : t('Тіркелу', 'Register')}
        </button>
      </form>
    </div>
  );
}
