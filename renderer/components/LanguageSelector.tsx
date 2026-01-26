/**
 * Language Selector Component
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

const LanguageSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  return (
    <div className="language-selector">
      <h3 className="language-selector-title">{t('settings.language')}</h3>
      <p className="language-selector-description">{t('settings.languageDescription')}</p>

      <div className="language-options">
        {languages.map((lang) => (
          <button
            key={lang.code}
            className={`language-option ${currentLanguage === lang.code ? 'active' : ''}`}
            onClick={() => handleLanguageChange(lang.code)}
            title={lang.name}
          >
            <span className="language-flag">{lang.flag}</span>
            <div className="language-info">
              <span className="language-native-name">{lang.nativeName}</span>
              <span className="language-english-name">{lang.name}</span>
            </div>
            {currentLanguage === lang.code && (
              <svg className="language-checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSelector;
