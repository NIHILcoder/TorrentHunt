import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ru';

// Simple dictionary
const dictionary = {
  en: {
    // Sidebar
    'nav.downloads': 'Downloads',
    'nav.catalog': 'Catalog',
    'nav.settings': 'Settings',
    'nav.create': 'Create Torrent',
    'nav.menu': 'Menu',
    
    // Downloads
    'filter.all': 'All',
    'filter.downloading': 'Downloading',
    'filter.completed': 'Completed',
    'filter.paused': 'Paused',
    'filter.error': 'Error',
    'btn.addTorrent': 'Add Torrent',
    'btn.addUrl': 'Add URL/Magnet',
    'search.placeholder': 'Search downloads...',
    'table.name': 'Name',
    'table.size': 'Size',
    'table.progress': 'Progress',
    'table.status': 'Status',
    'table.speed': 'Speed',
    'table.eta': 'ETA',
    'table.peers': 'Peers',
    'context.pause': 'Pause',
    'context.resume': 'Resume',
    'context.delete': 'Delete',
    'context.deleteFiles': 'Delete with files',
    'context.openFolder': 'Open Folder',
    'context.copyMagnet': 'Copy Magnet Link',
    
    // Catalog
    'catalog.title': 'Community Catalog',
    'catalog.subtitle': 'Discover public domain and open source content',
    'catalog.search': 'Search catalog...',
    'catalog.refresh': 'Refresh',
    'catalog.add': 'Add to Downloads',
    'catalog.category.all': 'All Categories',
    
    // Create Torrent
    'create.title': 'Create New Torrent',
    'create.subtitle': 'Share your files with the world',
    'create.selectFiles': 'Select Files or Folders',
    'create.drop': 'Drag & Drop files here',
    'create.browse': 'or click to browse',
    'create.name': 'Torrent Name',
    'create.name.placeholder': 'Enter a descriptive name',
    'create.trackers': 'Trackers',
    'create.trackers.placeholder': 'One tracker URL per line',
    'create.comment': 'Comment',
    'create.comment.placeholder': 'Optional description',
    'create.private': 'Private Torrent',
    'create.startSeeding': 'Start seeding immediately',
    'create.submit': 'Create & Save Torrent',
    
    // Settings
    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.downloads': 'Downloads',
    'settings.network': 'Network',
    'settings.advanced': 'Advanced',
    'settings.scheduler': 'Scheduler',
    'settings.seeding': 'Collaborative Seeding',
    'settings.interface': 'Interface',
    'settings.notifications': 'Notifications',
    'settings.system': 'System',
    'settings.hotkeys': 'Hotkeys',
    'settings.about': 'About',
    
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
    'nav.create': 'Создать торрент',
    'nav.menu': 'Меню',
    
    // Downloads
    'filter.all': 'Все',
    'filter.downloading': 'Загружаются',
    'filter.completed': 'Завершены',
    'filter.paused': 'На паузе',
    'filter.error': 'Ошибки',
    'btn.addTorrent': 'Добавить торрент',
    'btn.addUrl': 'Добавить URL/Magnet',
    'search.placeholder': 'Поиск загрузок...',
    'table.name': 'Имя',
    'table.size': 'Размер',
    'table.progress': 'Прогресс',
    'table.status': 'Статус',
    'table.speed': 'Скорость',
    'table.eta': 'Осталось',
    'table.peers': 'Пиры',
    'context.pause': 'Пауза',
    'context.resume': 'Продолжить',
    'context.delete': 'Удалить',
    'context.deleteFiles': 'Удалить с файлами',
    'context.openFolder': 'Открыть папку',
    'context.copyMagnet': 'Копировать Magnet-ссылку',
    
    // Catalog
    'catalog.title': 'Каталог сообщества',
    'catalog.subtitle': 'Находите открытый и бесплатный контент',
    'catalog.search': 'Поиск в каталоге...',
    'catalog.refresh': 'Обновить',
    'catalog.add': 'В Загрузки',
    'catalog.category.all': 'Все категории',
    
    // Create Torrent
    'create.title': 'Создать новый торрент',
    'create.subtitle': 'Поделитесь файлами с миром',
    'create.selectFiles': 'Выберите файлы или папки',
    'create.drop': 'Перетащите файлы сюда',
    'create.browse': 'или нажмите для выбора',
    'create.name': 'Имя торрента',
    'create.name.placeholder': 'Введите понятное название',
    'create.trackers': 'Трекеры',
    'create.trackers.placeholder': 'Один URL трекера на строку',
    'create.comment': 'Комментарий',
    'create.comment.placeholder': 'Необязательное описание',
    'create.private': 'Приватный торрент',
    'create.startSeeding': 'Начать раздачу сразу',
    'create.submit': 'Создать и сохранить',
    
    // Settings
    'settings.title': 'Настройки',
    'settings.general': 'Основные',
    'settings.downloads': 'Загрузки',
    'settings.network': 'Сеть',
    'settings.advanced': 'Продвинутые',
    'settings.scheduler': 'Расписание',
    'settings.seeding': 'Коллаб. Раздача',
    'settings.interface': 'Интерфейс',
    'settings.notifications': 'Уведомления',
    'settings.system': 'Система',
    'settings.hotkeys': 'Горячие клавиши',
    'settings.about': 'О программе',
    
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
