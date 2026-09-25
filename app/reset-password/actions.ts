'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_LOCALE, isAppLocale, translate, type AppLocale } from '@/lib/locale';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RECOVERY_COOKIE = 'spottedai_password_recovery';

type ActionResult = {
  error?: string;
  success?: string;
};

function getResetCallbackUrl(origin: string | null) {
  const configuredUrl = process.env.APP_URL?.trim();
  // Prefer the actual origin of the page that requested the reset. This keeps
  // production emails on the live domain even when APP_URL still has a local
  // development value. APP_URL is only the fallback for non-browser calls.
  const baseUrl = origin && /^https?:\/\//i.test(origin)
    ? origin
    : configuredUrl && /^https?:\/\//i.test(configuredUrl)
      ? configuredUrl
      : 'http://localhost:3000';

  return new URL('/auth/callback?next=/reset-password', baseUrl).toString();
}

function getTranslator(locale: AppLocale) {
  return (kazakh: string, english: string, russian?: string) => translate(locale, kazakh, english, russian);
}

export async function requestPasswordReset({
  email,
  locale: requestedLocale,
}: {
  email: string;
  locale?: AppLocale;
}): Promise<ActionResult> {
  const locale = isAppLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const t = getTranslator(locale);
  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254) {
    return {
      error: t(
        'Жарамды email мекенжайын енгізіңіз.',
        'Enter a valid email address.',
        'Введите корректный email.'
      ),
    };
  }

  // Keep the response deliberately generic. The function still prevents an
  // email from being sent for missing, unconfirmed, pending, or rejected users.
  const genericSuccess = t(
    'Егер бұл email расталған аккаунтқа тиесілі болса, құпиясөзді жаңарту сілтемесі жіберілді.',
    'If this email belongs to a confirmed account, a password-reset link has been sent.',
    'Если этот email принадлежит подтверждённой учётной записи, ссылка для сброса пароля отправлена.'
  );

  let canReset: boolean | null = null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('can_request_password_reset', {
      requested_email: normalizedEmail,
    });

    if (error) throw error;
    canReset = data;
  } catch (error) {
    console.error('Could not check password reset eligibility:', error);
    const errorCode = typeof error === 'object' && error && 'code' in error
      ? error.code
      : undefined;
    return {
      error: t(
        errorCode === 'PGRST202'
          ? 'Құпиясөзді қалпына келтіру әлі бапталмаған. Әкімші Supabase миграциясын орындауы керек.'
          : 'Құпиясөзді қалпына келтіруді тексеру мүмкін болмады. Кейінірек қайталап көріңіз.',
        errorCode === 'PGRST202'
          ? 'Password reset has not been configured yet. An administrator must apply the Supabase migration.'
          : 'Password-reset eligibility could not be checked. Please try again later.',
        errorCode === 'PGRST202'
          ? 'Сброс пароля ещё не настроен. Администратор должен выполнить миграцию Supabase.'
          : 'Не удалось проверить возможность сброса пароля. Попробуйте позже.'
      ),
    };
  }

  if (canReset !== true) return { success: genericSuccess };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: getResetCallbackUrl((await headers()).get('origin')),
  });

  if (error) {
    console.error('Could not send password reset email:', error.message);
    return {
      error: t(
        'Сілтемені жіберу мүмкін болмады. Кейінірек қайталап көріңіз.',
        'Could not send the reset link. Please try again later.',
        'Не удалось отправить ссылку. Попробуйте позже.'
      ),
    };
  }

  return { success: genericSuccess };
}

export async function completePasswordReset({
  password,
  confirmation,
  locale: requestedLocale,
}: {
  password: string;
  confirmation: string;
  locale?: AppLocale;
}): Promise<ActionResult> {
  const locale = isAppLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const t = getTranslator(locale);

  if (password.length < 6 || password.length > 128) {
    return {
      error: t(
        'Құпиясөз 6–128 таңбадан тұруы керек.',
        'Your password must be 6–128 characters long.',
        'Пароль должен содержать от 6 до 128 символов.'
      ),
    };
  }

  if (password !== confirmation) {
    return {
      error: t(
        'Құпиясөздер сәйкес келмейді.',
        'The passwords do not match.',
        'Пароли не совпадают.'
      ),
    };
  }

  const supabase = await createClient();
  const cookieStore = await cookies();
  const isRecoverySession = cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === '1';
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isRecoverySession || !user) {
    return {
      error: t(
        'Бұл сілтеме жарамсыз немесе мерзімі өтіп кеткен. Жаңа сілтеме сұраңыз.',
        'This link is invalid or has expired. Request a new one.',
        'Эта ссылка недействительна или устарела. Запросите новую.'
      ),
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single();

  if (profile?.status !== 'APPROVED') {
    await supabase.auth.signOut();
    cookieStore.set(PASSWORD_RECOVERY_COOKIE, '', { path: '/reset-password', maxAge: 0 });
    return {
      error: t(
        'Бұл аккаунт әлі расталмаған.',
        'This account has not been confirmed yet.',
        'Эта учётная запись ещё не подтверждена.'
      ),
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error('Could not update password:', error.message);
    return {
      error: t(
        'Құпиясөзді жаңарту мүмкін болмады. Жаңа сілтеме сұраңыз.',
        'Could not update the password. Request a new link.',
        'Не удалось обновить пароль. Запросите новую ссылку.'
      ),
    };
  }

  cookieStore.set(PASSWORD_RECOVERY_COOKIE, '', { path: '/reset-password', maxAge: 0 });
  await supabase.auth.signOut();

  return {
    success: t(
      'Құпиясөз жаңартылды. Енді жаңа құпиясөзбен кіре аласыз.',
      'Your password was updated. You can now sign in with the new password.',
      'Пароль обновлён. Теперь можно войти с новым паролем.'
    ),
  };
}
