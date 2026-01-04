import React, { useState } from 'react';
import { Icon } from './Icon';
import './NotificationSettings.css';

interface NotificationSettingsProps {
  enableNotifications: boolean;
  enableSounds: boolean;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
  onSettingsChange: (settings: {
    enableNotifications: boolean;
    enableSounds: boolean;
    notifyOnComplete: boolean;
    notifyOnError: boolean;
  }) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  enableNotifications,
  enableSounds,
  notifyOnComplete,
  notifyOnError,
  onSettingsChange,
}) => {
  const [testingNotification, setTestingNotification] = useState(false);

  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      // Mock notification for now - implement actual API call later
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('TorrentHunt', {
          body: 'Это тестовое уведомление. Все работает! 🎉',
        });
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    } finally {
      setTimeout(() => setTestingNotification(false), 1000);
    }
  };

  return (
    <div className="notification-settings">
      <div className="setting-item">
        <div className="setting-info">
          <label className="setting-label">
            <Icon name="bell" size={16} />
            Системные уведомления
          </label>
          <p className="setting-description">
            Показывать уведомления Windows при завершении загрузок
          </p>
        </div>
        <div className="setting-control">
          <button
            className={`toggle-switch ${enableNotifications ? 'active' : ''}`}
            onClick={() =>
              onSettingsChange({
                enableNotifications: !enableNotifications,
                enableSounds,
                notifyOnComplete,
                notifyOnError,
              })
            }
          >
            <span className="toggle-slider" />
          </button>
        </div>
      </div>

      {enableNotifications && (
        <>
          <div className="setting-divider" />

          <div className="setting-item">
            <div className="setting-info">
              <label className="setting-label">Звуковые уведомления</label>
              <p className="setting-description">
                Воспроизводить звук при показе уведомлений
              </p>
            </div>
            <div className="setting-control">
              <button
                className={`toggle-switch ${enableSounds ? 'active' : ''}`}
                onClick={() =>
                  onSettingsChange({
                    enableNotifications,
                    enableSounds: !enableSounds,
                    notifyOnComplete,
                    notifyOnError,
                  })
                }
              >
                <span className="toggle-slider" />
              </button>
            </div>
          </div>

          <div className="setting-divider" />

          <div className="notification-events">
            <div className="notification-events-label">Уведомлять о событиях:</div>
            <div className="notification-event-item">
              <label className="notification-checkbox">
                <input
                  type="checkbox"
                  checked={notifyOnComplete}
                  onChange={(e) =>
                    onSettingsChange({
                      enableNotifications,
                      enableSounds,
                      notifyOnComplete: e.target.checked,
                      notifyOnError,
                    })
                  }
                />
                <span className="checkbox-custom">
                  {notifyOnComplete && <Icon name="check" size={14} />}
                </span>
                <span className="checkbox-label">
                  <Icon name="check-circle" size={16} />
                  Завершение загрузки
                </span>
              </label>
            </div>
            <div className="notification-event-item">
              <label className="notification-checkbox">
                <input
                  type="checkbox"
                  checked={notifyOnError}
                  onChange={(e) =>
                    onSettingsChange({
                      enableNotifications,
                      enableSounds,
                      notifyOnComplete,
                      notifyOnError: e.target.checked,
                    })
                  }
                />
                <span className="checkbox-custom">
                  {notifyOnError && <Icon name="check" size={14} />}
                </span>
                <span className="checkbox-label">
                  <Icon name="alert-triangle" size={16} />
                  Ошибки загрузки
                </span>
              </label>
            </div>
          </div>

          <div className="setting-divider" />

          <div className="notification-test">
            <button
              className="btn-test-notification"
              onClick={handleTestNotification}
              disabled={testingNotification}
            >
              <Icon name="bell" size={16} />
              {testingNotification ? 'Отправляется...' : 'Тестовое уведомление'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
