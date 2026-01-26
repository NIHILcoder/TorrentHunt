/**
 * i18next Configuration
 * Internationalization setup for TorrentHunt
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files directly
import enTranslation from '../locales/en/translation.json';
import ruTranslation from '../locales/ru/translation.json';
import zhTranslation from '../locales/zh/translation.json';

// Get saved language or detect system language
const getSavedLanguage = (): string => {
  try {
    const saved = localStorage.getItem('language');
    if (saved) return saved;
  } catch (error) {
    console.error('Failed to get saved language:', error);
  }

  // Detect system language
  const systemLang = navigator.language.toLowerCase();
  if (systemLang.startsWith('ru')) return 'ru';
  if (systemLang.startsWith('zh')) return 'zh';
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    lng: getSavedLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru', 'zh'],

    resources: {
      en: {
        translation: enTranslation,
      },
      ru: {
        translation: ruTranslation,
      },
      zh: {
        translation: zhTranslation,
      },
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    react: {
      useSuspense: true,
    },

    debug: process.env.NODE_ENV === 'development',

    ns: ['translation'],
    defaultNS: 'translation',

    // Save language preference when changed
    saveMissing: false,

    // Key separator
    keySeparator: '.',

    // Nested separator
    nsSeparator: ':',
  });

// Listen for language changes and save to localStorage
i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('language', lng);
    document.documentElement.setAttribute('lang', lng);
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
});

export default i18n;
