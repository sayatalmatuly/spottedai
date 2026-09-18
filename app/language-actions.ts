'use server';

import { cookies } from 'next/headers';
import { isAppLocale, LOCALE_COOKIE, type AppLocale } from '@/lib/locale';

export async function saveLocale(locale: AppLocale) {
  if (!isAppLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
}
