import React from 'react';
import { Icon } from './Icon';
import './ProxySettings.css';

interface ProxySettingsProps {
  enabled: boolean;
  type: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username: string;
  password: string;
  onChange: (settings: {
    enabled: boolean;
    type: 'http' | 'https' | 'socks5';
    host: string;
    port: number;
    username: string;
    password: string;
  }) => void;
}

export const ProxySettings: React.FC<ProxySettingsProps> = ({
  enabled,
  type,
  host,
  port,
  username,
  password,
  onChange,
}) => {
  return (
    <div className="proxy-settings">
      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">
            <Icon name="shield" size={16} />
            Использовать прокси
          </label>
          <p className="setting-description">
            Направить весь трафик торрентов через прокси-сервер
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${enabled ? 'active' : ''}`}
            onClick={() => onChange({ enabled: !enabled, type, host, port, username, password })}
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      {enabled && (
        <>
          <div className="setting-divider" />

          <div className="proxy-config">
            <div className="proxy-field">
              <label className="proxy-label">Тип прокси</label>
              <select
                className="proxy-select"
                value={type}
                onChange={(e) =>
                  onChange({
                    enabled,
                    type: e.target.value as 'http' | 'https' | 'socks5',
                    host,
                    port,
                    username,
                    password,
                  })
                }
              >
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>

            <div className="proxy-row">
              <div className="proxy-field flex-1">
                <label className="proxy-label">Хост</label>
                <input
                  type="text"
                  className="proxy-input"
                  placeholder="proxy.example.com"
                  value={host}
                  onChange={(e) =>
                    onChange({ enabled, type, host: e.target.value, port, username, password })
                  }
                />
              </div>
              <div className="proxy-field">
                <label className="proxy-label">Порт</label>
                <input
                  type="number"
                  className="proxy-input proxy-input-port"
                  placeholder="8080"
                  value={port || ''}
                  onChange={(e) =>
                    onChange({
                      enabled,
                      type,
                      host,
                      port: parseInt(e.target.value) || 0,
                      username,
                      password,
                    })
                  }
                />
              </div>
            </div>

            <div className="proxy-auth">
              <div className="proxy-auth-header">
                <Icon name="lock" size={14} />
                <span>Аутентификация (опционально)</span>
              </div>
              <div className="proxy-row">
                <div className="proxy-field flex-1">
                  <label className="proxy-label">Имя пользователя</label>
                  <input
                    type="text"
                    className="proxy-input"
                    placeholder="username"
                    value={username}
                    onChange={(e) =>
                      onChange({ enabled, type, host, port, username: e.target.value, password })
                    }
                  />
                </div>
                <div className="proxy-field flex-1">
                  <label className="proxy-label">Пароль</label>
                  <input
                    type="password"
                    className="proxy-input"
                    placeholder="password"
                    value={password}
                    onChange={(e) =>
                      onChange({ enabled, type, host, port, username, password: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
