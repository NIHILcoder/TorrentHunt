import React, { useState } from 'react';
import { Icon } from './Icon';
import './HotkeySettings.css';

interface Hotkey {
  id: string;
  label: string;
  description: string;
  keys: string[];
  category: string;
}

interface HotkeySettingsProps {
  hotkeys: Hotkey[];
  onHotkeyChange: (hotkeyId: string, keys: string[]) => void;
  onResetHotkeys: () => void;
}

export const HotkeySettings: React.FC<HotkeySettingsProps> = ({
  hotkeys,
  onHotkeyChange,
  onResetHotkeys,
}) => {
  const [editingHotkey, setEditingHotkey] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const categories = Array.from(new Set(hotkeys.map((h) => h.category)));

  const handleStartRecording = (hotkeyId: string) => {
    setEditingHotkey(hotkeyId);
    setRecordedKeys([]);
    setIsRecording(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();

    const keys: string[] = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.shiftKey) keys.push('Shift');
    if (e.altKey) keys.push('Alt');
    if (e.metaKey) keys.push('Meta');

    const key = e.key;
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
      keys.push(key.toUpperCase());
    }

    if (keys.length > 0) {
      setRecordedKeys(keys);
    }
  };

  const handleKeyUp = () => {
    if (!isRecording || recordedKeys.length === 0) return;

    if (editingHotkey) {
      onHotkeyChange(editingHotkey, recordedKeys);
    }

    setIsRecording(false);
    setEditingHotkey(null);
    setRecordedKeys([]);
  };

  const handleCancel = () => {
    setIsRecording(false);
    setEditingHotkey(null);
    setRecordedKeys([]);
  };

  return (
    <div className="hotkey-settings">
      <div className="hotkey-header">
        <div className="hotkey-header-info">
          <Icon name="keyboard" size={20} />
          <div>
            <h3>Горячие клавиши</h3>
            <p>Настройте комбинации клавиш для быстрого доступа к функциям</p>
          </div>
        </div>
        <button className="btn-reset-hotkeys" onClick={onResetHotkeys}>
          <Icon name="rotate-ccw" size={16} />
          Сбросить все
        </button>
      </div>

      {categories.map((category) => (
        <div key={category} className="hotkey-category">
          <div className="hotkey-category-title">{category}</div>
          <div className="hotkey-list">
            {hotkeys
              .filter((h) => h.category === category)
              .map((hotkey) => (
                <div key={hotkey.id} className="hotkey-item">
                  <div className="hotkey-info">
                    <div className="hotkey-label">{hotkey.label}</div>
                    <div className="hotkey-description">{hotkey.description}</div>
                  </div>
                  <div className="hotkey-control">
                    {editingHotkey === hotkey.id ? (
                      <div
                        className="hotkey-recorder"
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                        tabIndex={0}
                        autoFocus
                      >
                        <span className="hotkey-recorder-text">
                          {recordedKeys.length > 0
                            ? recordedKeys.join(' + ')
                            : 'Нажмите клавиши...'}
                        </span>
                        <button className="btn-cancel-recording" onClick={handleCancel}>
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="hotkey-display"
                        onClick={() => handleStartRecording(hotkey.id)}
                      >
                        {hotkey.keys.length > 0 ? (
                          <span className="hotkey-keys">
                            {hotkey.keys.map((key, idx) => (
                              <React.Fragment key={idx}>
                                {idx > 0 && <span className="hotkey-plus">+</span>}
                                <kbd className="hotkey-key">{key}</kbd>
                              </React.Fragment>
                            ))}
                          </span>
                        ) : (
                          <span className="hotkey-empty">Не назначено</span>
                        )}
                        <Icon name="edit-2" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Default hotkeys for the settings page
export const defaultHotkeys: Hotkey[] = [
  {
    id: 'open-downloads',
    label: 'Открыть загрузки',
    description: 'Переключиться на страницу загрузок',
    keys: ['Ctrl', 'D'],
    category: 'Навигация',
  },
  {
    id: 'open-catalog',
    label: 'Открыть каталог',
    description: 'Переключиться на страницу каталога',
    keys: ['Ctrl', 'K'],
    category: 'Навигация',
  },
  {
    id: 'open-settings',
    label: 'Открыть настройки',
    description: 'Открыть страницу настроек',
    keys: ['Ctrl', ','],
    category: 'Навигация',
  },
  {
    id: 'add-torrent',
    label: 'Добавить торрент',
    description: 'Открыть диалог добавления торрента',
    keys: ['Ctrl', 'O'],
    category: 'Торренты',
  },
  {
    id: 'create-torrent',
    label: 'Создать торрент',
    description: 'Перейти к созданию торрента',
    keys: ['Ctrl', 'N'],
    category: 'Торренты',
  },
  {
    id: 'pause-all',
    label: 'Приостановить все',
    description: 'Приостановить все активные загрузки',
    keys: ['Ctrl', 'Shift', 'P'],
    category: 'Торренты',
  },
  {
    id: 'resume-all',
    label: 'Возобновить все',
    description: 'Возобновить все приостановленные загрузки',
    keys: ['Ctrl', 'Shift', 'R'],
    category: 'Торренты',
  },
];
