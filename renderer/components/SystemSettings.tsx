import React from 'react';
import { Icon } from './Icon';
import './SystemSettings.css';

interface SystemSettingsProps {
  autoLaunch: boolean;
  autoUpdate: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  onAutoLaunchChange: (enabled: boolean) => void;
  onAutoUpdateChange: (enabled: boolean) => void;
  onMinimizeToTrayChange: (enabled: boolean) => void;
  onCloseToTrayChange: (enabled: boolean) => void;
  onCheckForUpdates: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({
  autoLaunch,
  autoUpdate,
  minimizeToTray,
  closeToTray,
  onAutoLaunchChange,
  onAutoUpdateChange,
  onMinimizeToTrayChange,
  onCloseToTrayChange,
  onCheckForUpdates,
}) => {
  return (
    <div className="system-settings">
      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">
            <Icon name="power" size={16} />
            Автозапуск с Windows
          </label>
          <p className="setting-description">
            Автоматически запускать TorrentHunt при входе в систему
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${autoLaunch ? 'active' : ''}`}
            onClick={() => onAutoLaunchChange(!autoLaunch)}
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      <div className="setting-divider" />

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">
            <Icon name="download-cloud" size={16} />
            Автоматические обновления
          </label>
          <p className="setting-description">
            Автоматически загружать и устанавливать обновления приложения
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${autoUpdate ? 'active' : ''}`}
            onClick={() => onAutoUpdateChange(!autoUpdate)}
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      <div className="setting-divider" />

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">Свернуть в трей</label>
          <p className="setting-description">
            Сворачивать приложение в системный трей вместо панели задач
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${minimizeToTray ? 'active' : ''}`}
            onClick={() => onMinimizeToTrayChange(!minimizeToTray)}
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      <div className="setting-divider" />

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">Закрыть в трей</label>
          <p className="setting-description">
            При закрытии окна сворачивать приложение в трей вместо выхода
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${closeToTray ? 'active' : ''}`}
            onClick={() => onCloseToTrayChange(!closeToTray)}
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      <div className="setting-divider" />

      <div className="update-check">
        <button className="btn-check-updates" onClick={onCheckForUpdates}>
          <Icon name="refresh-cw" size={16} />
          Проверить обновления
        </button>
        <p className="update-info">Последняя проверка: сегодня в 12:34</p>
      </div>
    </div>
  );
};
