import React from 'react';
import { Icon } from './Icon';
import './AppStatistics.css';

interface AppStatisticsProps {
  totalDownloads: number;
  totalUploaded: string;
  totalDownloaded: string;
  cacheSize: string;
  diskUsage: string;
  uptime: string;
}

export const AppStatistics: React.FC<AppStatisticsProps> = ({
  totalDownloads,
  totalUploaded,
  totalDownloaded,
  cacheSize,
  diskUsage,
  uptime,
}) => {
  return (
    <div className="app-statistics">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Icon name="download" size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Всего загрузок</div>
            <div className="stat-value">{totalDownloads}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Icon name="arrow-down" size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Загружено</div>
            <div className="stat-value">{totalDownloaded}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Icon name="arrow-up" size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Отдано</div>
            <div className="stat-value">{totalUploaded}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Icon name="database" size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Кеш</div>
            <div className="stat-value">{cacheSize}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Icon name="hard-drive" size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Использовано</div>
            <div className="stat-value">{diskUsage}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Icon name="clock" size={20} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Время работы</div>
            <div className="stat-value">{uptime}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
