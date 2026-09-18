import 'server-only';

import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isAppLocale, LOCALE_COOKIE } from './locale';

export async function getCurrentLocale() {
  const savedLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isAppLocale(savedLocale) ? savedLocale : DEFAULT_LOCALE;
}
