/**
 * Example: Localized Download Item Component
 *
 * This is an example of how to properly localize a component
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes, formatSpeed, formatDuration, getStatusText } from '../utils/i18n-helpers';

interface DownloadItemProps {
  name: string;
  size: number;
  downloaded: number;
  downloadSpeed: number;
  timeRemaining: number;
  status: 'downloading' | 'seeding' | 'completed' | 'paused' | 'error';
}

/**
 * Example component showing i18n best practices
 */
export const LocalizedDownloadItem: React.FC<DownloadItemProps> = ({
  name,
  size,
  downloaded,
  downloadSpeed,
  timeRemaining,
  status,
}) => {
  const { t } = useTranslation();

  return (
    <div className="download-item">
      <div className="download-header">
        <h3>{name}</h3>
        <span className={`status ${status}`}>
          {getStatusText(status)}
        </span>
      </div>

      <div className="download-details">
        <div className="detail-row">
          <span className="detail-label">{t('downloads.details.size')}:</span>
          <span className="detail-value">{formatBytes(size)}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">{t('downloads.details.downloaded')}:</span>
          <span className="detail-value">{formatBytes(downloaded)}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">{t('downloads.details.downloadSpeed')}:</span>
          <span className="detail-value">{formatSpeed(downloadSpeed)}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">{t('downloads.details.timeRemaining')}:</span>
          <span className="detail-value">{formatDuration(timeRemaining)}</span>
        </div>
      </div>

      <div className="download-actions">
        {status === 'downloading' && (
          <>
            <button className="btn-action" title={t('downloads.actions.pause')}>
              {t('common.pause')}
            </button>
            <button className="btn-action" title={t('downloads.actions.remove')}>
              {t('common.remove')}
            </button>
          </>
        )}

        {status === 'paused' && (
          <>
            <button className="btn-action" title={t('downloads.actions.resume')}>
              {t('common.resume')}
            </button>
            <button className="btn-action" title={t('downloads.actions.remove')}>
              {t('common.remove')}
            </button>
          </>
        )}

        {(status === 'completed' || status === 'seeding') && (
          <>
            <button className="btn-action" title={t('downloads.actions.openFolder')}>
              {t('downloads.actions.openFolder')}
            </button>
            <button className="btn-action" title={t('downloads.actions.remove')}>
              {t('common.remove')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * USAGE EXAMPLE:
 *
 * import { LocalizedDownloadItem } from './examples/LocalizedDownloadItem';
 *
 * <LocalizedDownloadItem
 *   name="Ubuntu 22.04 LTS"
 *   size={3221225472}  // 3 GB
 *   downloaded={1610612736}  // 1.5 GB
 *   downloadSpeed={5242880}  // 5 MB/s
 *   timeRemaining={320}  // 5m 20s
 *   status="downloading"
 * />
 *
 * This will automatically show:
 * - EN: "3.00 GB", "1.50 GB", "5.00 MB/s", "5 minutes 20 seconds"
 * - RU: "3.00 ГБ", "1.50 ГБ", "5.00 МБ/с", "5 минут 20 секунд"
 * - ZH: "3.00 GB", "1.50 GB", "5.00 MB/s", "5 分钟 20 秒"
 */

export default LocalizedDownloadItem;
