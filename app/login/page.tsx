'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { requestTeacherRegistration } from './actions';
import './login.css';

export default function LoginPage() {
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
            ? 'Неверный email или пароль'
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
        setError('Ваш аккаунт ещё не одобрен администратором. Дождитесь подтверждения.');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } else {
      let result;
      try {
        result = await requestTeacherRegistration({ fullName, email, password });
      } catch (registrationError) {
        console.error(registrationError);
        setError('Не удалось отправить заявку. Попробуйте ещё раз.');
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
            ? 'Заявка отправлена администратору. После подтверждения вы сможете войти.'
            : 'Заявка создана. Администратору не удалось отправить уведомление — сообщите ему о заявке.'
        );
        setLoading(false);
      }
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-glyph">Ж</div>
        <h1>Журнал</h1>
        <p className="login-sub">Электронный журнал посещаемости</p>

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
            Войти
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
            Регистрация
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        {mode === 'signup' && (
          <label>
            <span>ФИО</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванова Ольга Сергеевна"
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
          <span>Пароль</span>
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
              ? 'Вход...'
              : 'Регистрация...'
            : mode === 'login'
            ? 'Войти'
            : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  );
}
