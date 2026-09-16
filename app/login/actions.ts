'use server';

import { createClient } from '@/lib/supabase/server';
import { sendRegistrationNotification } from '@/lib/registration-email';

type RegistrationInput = {
  fullName: string;
  email: string;
  password: string;
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
}: RegistrationInput): Promise<RegistrationResult> {
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
    return { error: 'Заполните ФИО, email и пароль не короче 6 символов.' };
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
