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
  isDefaultClient: boolean;
  onSetDefaultClient: () => void;
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
  isDefaultClient,
  onSetDefaultClient,
  onCheckForUpdates,
}) => {
  return (
    <div className="system-settings">
      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">
            <Icon name="power" size={16} />
            Auto Launch with Windows
          </label>
          <p className="setting-description">
            Automatically start TorrentHunt when you log in
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
            Automatic Updates
          </label>
          <p className="setting-description">
            Automatically download and install app updates
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
          <label className="setting-label">Minimize to Tray</label>
          <p className="setting-description">
            Minimize app to system tray instead of taskbar
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
          <label className="setting-label">Close to Tray</label>
          <p className="setting-description">
            Hide window to tray instead of quitting when closing
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

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">
            <Icon name="link" size={16} />
            Default Torrent Client
          </label>
          <p className="setting-description">
            Open .torrent files and magnet links with TorrentHunt
          </p>
        </div>
        <div className="setting-control">
          {isDefaultClient ? (
            <span className="status-badge success" style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              <Icon name="check-circle" size={14} />
              Current Default
            </span>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={onSetDefaultClient}>
              Set as Default
            </button>
          )}
        </div>
      </div>

      <div className="setting-divider" />

      <div className="update-check">
        <button className="btn-check-updates" onClick={onCheckForUpdates}>
          <Icon name="refresh-cw" size={16} />
          Check for Updates
        </button>
        <p className="update-info">Last checked: today at 12:34</p>
      </div>
    </div>
  );
};
