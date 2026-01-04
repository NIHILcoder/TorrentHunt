import React from 'react';
import { Icon } from './Icon';
import './SettingsBackup.css';

interface SettingsBackupProps {
  onExport: () => void;
  onImport: () => void;
}

export const SettingsBackup: React.FC<SettingsBackupProps> = ({ onExport, onImport }) => {
  return (
    <div className="settings-backup">
      <div className="backup-card">
        <div className="backup-icon">
          <Icon name="upload-cloud" size={32} />
        </div>
        <div className="backup-info">
          <h3>Экспорт настроек</h3>
          <p>Сохранить все настройки в файл для резервной копии или переноса на другой компьютер</p>
        </div>
        <button className="btn-backup" onClick={onExport}>
          <Icon name="upload" size={16} />
          Экспортировать
        </button>
      </div>

      <div className="backup-card">
        <div className="backup-icon">
          <Icon name="download-cloud" size={32} />
        </div>
        <div className="backup-info">
          <h3>Импорт настроек</h3>
          <p>Восстановить настройки из ранее сохраненного файла</p>
        </div>
        <button className="btn-backup secondary" onClick={onImport}>
          <Icon name="download" size={16} />
          Импортировать
        </button>
      </div>

      <div className="backup-notice">
        <Icon name="info" size={16} />
        <span>
          Экспорт включает: настройки приложения, горячие клавиши, темы, но не включает торренты и их данные.
        </span>
      </div>
    </div>
  );
};
