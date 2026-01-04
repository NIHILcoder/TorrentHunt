import React from 'react';
import { Icon, IconName } from './Icon';
import './SpeedPresets.css';

interface SpeedPresetsProps {
  maxDownKbps: number;
  maxUpKbps: number;
  onSpeedChange: (down: number, up: number) => void;
}

interface Preset {
  id: string;
  label: string;
  icon: IconName;
  description: string;
  download: number; // KB/s, 0 = unlimited
  upload: number; // KB/s, 0 = unlimited
}

export const SpeedPresets: React.FC<SpeedPresetsProps> = ({
  maxDownKbps,
  maxUpKbps,
  onSpeedChange,
}) => {
  const presets: Preset[] = [
    {
      id: 'unlimited',
      label: 'Без ограничений',
      icon: 'zap',
      description: 'Максимальная скорость',
      download: 0,
      upload: 0,
    },
    {
      id: 'turbo',
      label: 'Турбо',
      icon: 'trending-up',
      description: '10 MB/s ↓ / 5 MB/s ↑',
      download: 10240,
      upload: 5120,
    },
    {
      id: 'normal',
      label: 'Нормальная',
      icon: 'activity',
      description: '5 MB/s ↓ / 2 MB/s ↑',
      download: 5120,
      upload: 2048,
    },
    {
      id: 'eco',
      label: 'Эконом',
      icon: 'shield',
      description: '1 MB/s ↓ / 512 KB/s ↑',
      download: 1024,
      upload: 512,
    },
  ];

  const isPresetActive = (preset: Preset) => {
    return preset.download === maxDownKbps && preset.upload === maxUpKbps;
  };

  return (
    <div className="speed-presets">
      <div className="speed-presets-label">
        <Icon name="gauge" size={16} />
        <span>Быстрые пресеты</span>
      </div>
      <div className="speed-presets-grid">
        {presets.map((preset) => (
          <button
            key={preset.id}
            className={`speed-preset-btn ${isPresetActive(preset) ? 'active' : ''}`}
            onClick={() => onSpeedChange(preset.download, preset.upload)}
          >
            <div className="speed-preset-icon">
              <Icon name={preset.icon} size={20} />
            </div>
            <div className="speed-preset-info">
              <div className="speed-preset-label">{preset.label}</div>
              <div className="speed-preset-description">{preset.description}</div>
            </div>
            {isPresetActive(preset) && (
              <div className="speed-preset-check">
                <Icon name="check" size={16} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
