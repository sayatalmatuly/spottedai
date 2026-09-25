'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { sendRegistrationNotification } from '@/lib/registration-email';
import { getAuthCallbackUrl } from '@/lib/auth-urls';
import { DEFAULT_LOCALE, isAppLocale, translate, type AppLocale } from '@/lib/locale';

type RegistrationInput = {
  fullName: string;
  email: string;
  password: string;
  locale?: AppLocale;
};

type RegistrationResult = {
  error?: string;
  sessionCreated?: boolean;
  notificationSent?: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestTeacherRegistration({
  fullName,
  email,
  password,
  locale: requestedLocale,
}: RegistrationInput): Promise<RegistrationResult> {
  const locale = isAppLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const normalizedName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (
    !normalizedName
    || normalizedName.length > 160
    || !EMAIL_PATTERN.test(normalizedEmail)
    || normalizedEmail.length > 254
    || password.length < 6
    || password.length > 128
  ) {
    return {
      error: translate(
        locale,
        'Аты-жөніңізді, email мекенжайын және кемінде 6 таңбадан тұратын құпиясөзді толтырыңыз.',
        'Enter your full name, email, and a password with at least 6 characters.'
      ),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: normalizedName,
        role: 'TEACHER',
      },
      emailRedirectTo: getAuthCallbackUrl({
        origin: (await headers()).get('origin'),
      }),
    },
  });

  if (error) {
    return { error: error.message };
  }

  // For an existing address Supabase may return a user with no identities.
  // Do not let that case generate another email to the administrator.
  const isNewUser = (data.user?.identities?.length || 0) > 0;
  const notification = isNewUser
    ? await sendRegistrationNotification({ fullName: normalizedName, email: normalizedEmail })
    : { sent: true };

  return {
    sessionCreated: Boolean(data.session),
    notificationSent: notification.sent,
  };
}
