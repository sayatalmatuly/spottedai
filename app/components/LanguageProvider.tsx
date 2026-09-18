'use client';

import { createContext, useContext, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveLocale } from '@/app/language-actions';
import type { AppLocale } from '@/lib/locale';

type LanguageContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  isChanging: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<AppLocale>(initialLocale);
  const [isChanging, startTransition] = useTransition();

  const changeLocale = (nextLocale: AppLocale) => {
    if (nextLocale === locale) return;

    setLocale(nextLocale);
    startTransition(async () => {
      await saveLocale(nextLocale);
      router.refresh();
    });
  };

  const value = useMemo(
    () => ({ locale, setLocale: changeLocale, isChanging }),
    [locale, isChanging]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
