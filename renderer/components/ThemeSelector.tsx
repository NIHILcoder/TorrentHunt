import React from 'react';
import { Icon } from './Icon';
import './ThemeSelector.css';

type Theme = 'light' | 'dark' | 'system';

interface ThemeSelectorProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

import { IconName } from './Icon';

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onThemeChange,
}) => {
  const themes: { id: Theme; label: string; icon: IconName; description: string }[] = [
    {
      id: 'light',
      label: 'Светлая',
      icon: 'sun',
      description: 'Светлая тема для комфортной работы днем',
    },
    {
      id: 'dark',
      label: 'Тёмная',
      icon: 'moon',
      description: 'Тёмная тема для снижения нагрузки на глаза',
    },
    {
      id: 'system',
      label: 'Системная',
      icon: 'monitor',
      description: 'Следовать системным настройкам',
    },
  ];

  return (
    <div className="theme-selector">
      {themes.map((theme) => (
        <button
          key={theme.id}
          className={`theme-card ${currentTheme === theme.id ? 'active' : ''}`}
          onClick={() => onThemeChange(theme.id)}
        >
          <div className="theme-preview">
            <div className={`theme-preview-content ${theme.id}`}>
              <div className="theme-preview-header"></div>
              <div className="theme-preview-body">
                <div className="theme-preview-sidebar"></div>
                <div className="theme-preview-main">
                  <div className="theme-preview-line"></div>
                  <div className="theme-preview-line short"></div>
                  <div className="theme-preview-line"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="theme-info">
            <div className="theme-icon">
              <Icon name={theme.icon} size={20} />
            </div>
            <div className="theme-text">
              <div className="theme-label">{theme.label}</div>
              <div className="theme-description">{theme.description}</div>
            </div>
          </div>
          {currentTheme === theme.id && (
            <div className="theme-check">
              <Icon name="check" size={18} />
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
