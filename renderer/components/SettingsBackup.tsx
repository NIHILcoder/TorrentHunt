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
          <h3>Export Settings</h3>
          <p>Save all settings to a file for backup or transfer to another computer</p>
        </div>
        <button className="btn-backup" onClick={onExport}>
          <Icon name="upload" size={16} />
          Export
        </button>
      </div>

      <div className="backup-card">
        <div className="backup-icon">
          <Icon name="download-cloud" size={32} />
        </div>
        <div className="backup-info">
          <h3>Import Settings</h3>
          <p>Restore settings from a previously saved file</p>
        </div>
        <button className="btn-backup secondary" onClick={onImport}>
          <Icon name="download" size={16} />
          Import
        </button>
      </div>

      <div className="backup-notice">
        <Icon name="info" size={16} />
        <span>
          Export includes: app settings, hotkeys, themes, but does not include torrents and their data.
        </span>
      </div>
    </div>
  );
};
