import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ru';

// Simple dictionary
const dictionary = {
  en: {
    // Sidebar
    'nav.downloads': 'Downloads',
    'nav.catalog': 'Catalog',
    'nav.settings': 'Settings',
    
    // Downloads
    'filter.all': 'All',
    'filter.downloading': 'Downloading',
    'filter.completed': 'Completed',
    'filter.paused': 'Paused',
    'filter.error': 'Error',
    'btn.addTorrent': 'Add Torrent',
    'search.placeholder': 'Search downloads...',
    
    // Settings
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.downloads': 'Downloads',
    'settings.network': 'Network',
    'settings.system': 'System Integration',
    'settings.language': 'Language',
    'settings.language.desc': 'Application interface language',
    'settings.theme': 'Color Scheme',
    'settings.theme.desc': 'Choose your preferred theme',
    
    // Add Torrent Modal/Preview
    'add.drop': 'Drop torrent file here',
    'add.dropSubtitle': 'to start downloading',
    'add.btn': 'Add Selected Torrent',
    
    // Status
    'status.seeding': 'Seeding',
    'status.downloading': 'Downloading',
    'status.queued': 'Queued',
    'status.completed': 'Completed',
    'status.paused': 'Paused',
    'status.error': 'Error',
    'status.removed': 'Removed',
  },
  ru: {
    // Sidebar
    'nav.downloads': 'Загрузки',
    'nav.catalog': 'Каталог',
    'nav.settings': 'Настройки',
    
    // Downloads
    'filter.all': 'Все',
    'filter.downloading': 'Загружаются',
    'filter.completed': 'Завершены',
    'filter.paused': 'На паузе',
    'filter.error': 'Ошибки',
    'btn.addTorrent': 'Добавить торрент',
    'search.placeholder': 'Поиск загрузок...',
    
    // Settings
    'settings.title': 'Настройки',
    'settings.general': 'Основные',
    'settings.downloads': 'Загрузки',
    'settings.network': 'Сеть',
    'settings.system': 'Системная интеграция',
    'settings.language': 'Язык',
    'settings.language.desc': 'Язык интерфейса приложения',
    'settings.theme': 'Цветовая схема',
    'settings.theme.desc': 'Выберите предпочтительную тему',
    
    // Add Torrent Modal/Preview
    'add.drop': 'Перетащите torrent файл сюда',
    'add.dropSubtitle': 'чтобы начать загрузку',
    'add.btn': 'Добавить выбранный торрент',
    
    // Status
    'status.seeding': 'Раздается',
    'status.downloading': 'Скачивается',
    'status.queued': 'В очереди',
    'status.completed': 'Завершен',
    'status.paused': 'На паузе',
    'status.error': 'Ошибка',
    'status.removed': 'Удален',
  }
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof dictionary.en) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language;
    if (saved && (saved === 'en' || saved === 'ru')) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: keyof typeof dictionary.en): string => {
    return dictionary[language][key] || dictionary.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};
