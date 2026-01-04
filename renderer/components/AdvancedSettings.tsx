import React from 'react';
import { Icon } from './Icon';
import './AdvancedSettings.css';

interface AdvancedSettingsProps {
  enableDHT: boolean;
  enablePEX: boolean;
  enableLSD: boolean;
  maxConnections: number;
  portMin: number;
  portMax: number;
  onChange: (settings: {
    enableDHT: boolean;
    enablePEX: boolean;
    enableLSD: boolean;
    maxConnections: number;
    portMin: number;
    portMax: number;
  }) => void;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  enableDHT,
  enablePEX,
  enableLSD,
  maxConnections,
  portMin,
  portMax,
  onChange,
}) => {
  return (
    <div className="advanced-settings">
      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">
            <Icon name="network" size={16} />
            DHT (Distributed Hash Table)
          </label>
          <p className="setting-description">
            Позволяет находить пиры без трекера
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${enableDHT ? 'active' : ''}`}
            onClick={() => onChange({ enableDHT: !enableDHT, enablePEX, enableLSD, maxConnections, portMin, portMax })}
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      <div className="setting-divider" />

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">PEX (Peer Exchange)</label>
          <p className="setting-description">
            Обмен списками пиров с другими клиентами
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${enablePEX ? 'active' : ''}`}
            onClick={() => onChange({ enableDHT, enablePEX: !enablePEX, enableLSD, maxConnections, portMin, portMax })}
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      <div className="setting-divider" />

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">LSD (Local Service Discovery)</label>
          <p className="setting-description">
            Поиск пиров в локальной сети
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${enableLSD ? 'active' : ''}`}
            onClick={() => onChange({ enableDHT, enablePEX, enableLSD: !enableLSD, maxConnections, portMin, portMax })}
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      <div className="setting-divider" />

      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">Максимум соединений</label>
          <p className="setting-description">
            Максимальное количество одновременных подключений к пирам
          </p>
        </div>
        <div className="setting-control">
          <input
            type="number"
            className="input input-number"
            min="10"
            max="500"
            value={maxConnections}
            onChange={(e) => onChange({ enableDHT, enablePEX, enableLSD, maxConnections: parseInt(e.target.value) || 100, portMin, portMax })}
          />
        </div>
      </div>

      <div className="setting-divider" />

      <div className="port-range">
        <label className="port-range-label">
          <Icon name="server" size={16} />
          Диапазон портов для входящих подключений
        </label>
        <div className="port-range-inputs">
          <div className="port-field">
            <label>От</label>
            <input
              type="number"
              className="input input-number"
              min="1024"
              max="65535"
              value={portMin}
              onChange={(e) => onChange({ enableDHT, enablePEX, enableLSD, maxConnections, portMin: parseInt(e.target.value) || 6881, portMax })}
            />
          </div>
          <span className="port-separator">—</span>
          <div className="port-field">
            <label>До</label>
            <input
              type="number"
              className="input input-number"
              min="1024"
              max="65535"
              value={portMax}
              onChange={(e) => onChange({ enableDHT, enablePEX, enableLSD, maxConnections, portMin, portMax: parseInt(e.target.value) || 6889 })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
