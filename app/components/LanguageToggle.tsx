'use client';

import { useLanguage } from './LanguageProvider';

export function LanguageToggle() {
  const { locale, setLocale, isChanging } = useLanguage();

  return (
    <div
      className="language-toggle"
      role="group"
      aria-label={locale === 'kk' ? 'Тілді таңдау' : locale === 'ru' ? 'Выбор языка' : 'Language selector'}
    >
      <button
        type="button"
        className={locale === 'kk' ? 'active' : ''}
        onClick={() => setLocale('kk')}
        aria-pressed={locale === 'kk'}
        disabled={isChanging}
      >
        ҚАЗ
      </button>
      <button
        type="button"
        className={locale === 'en' ? 'active' : ''}
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        disabled={isChanging}
      >
        EN
      </button>
      <button
        type="button"
        className={locale === 'ru' ? 'active' : ''}
        onClick={() => setLocale('ru')}
        aria-pressed={locale === 'ru'}
        disabled={isChanging}
      >
        РУ
      </button>
    </div>
  );
}
