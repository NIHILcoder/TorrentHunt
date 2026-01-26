/**
 * Localization helpers for formatting values
 */

import i18n from '../i18n';

/**
 * Format bytes to human-readable size with localized units
 */
export const formatBytes = (bytes: number): string => {
  const t = i18n.t.bind(i18n);

  if (bytes === 0) return `0 ${t('units.bytes')}`;

  const k = 1024;
  const sizes = [
    'units.bytes',
    'units.kilobytes',
    'units.megabytes',
    'units.gigabytes',
    'units.terabytes',
  ];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(2)} ${t(sizes[i])}`;
};

/**
 * Format speed to human-readable with localized units
 */
export const formatSpeed = (bytesPerSecond: number): string => {
  const t = i18n.t.bind(i18n);

  if (bytesPerSecond === 0) return `0 ${t('units.bytesPerSecond')}`;

  const k = 1024;
  const sizes = [
    'units.bytesPerSecond',
    'units.kilobytesPerSecond',
    'units.megabytesPerSecond',
    'units.gigabytesPerSecond',
  ];

  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  const value = bytesPerSecond / Math.pow(k, i);

  return `${value.toFixed(2)} ${t(sizes[i])}`;
};

/**
 * Format duration to human-readable with localized units
 */
export const formatDuration = (seconds: number): string => {
  const t = i18n.t.bind(i18n);

  if (seconds < 60) {
    return `${Math.floor(seconds)} ${t('units.seconds')}`;
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} ${t('units.minutes')}`;
  }

  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0
      ? `${hours} ${t('units.hours')} ${minutes} ${t('units.minutes')}`
      : `${hours} ${t('units.hours')}`;
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0
    ? `${days} ${t('units.days')} ${hours} ${t('units.hours')}`
    : `${days} ${t('units.days')}`;
};

/**
 * Get localized status text
 */
export const getStatusText = (status: string): string => {
  const t = i18n.t.bind(i18n);
  const statusKey = `downloads.status.${status}`;
  return t(statusKey, status); // fallback to status if key not found
};

/**
 * Get current language code
 */
export const getCurrentLanguage = (): string => {
  return i18n.language;
};

/**
 * Check if current language is RTL (for future Arabic support)
 */
export const isRTL = (): boolean => {
  const rtlLanguages = ['ar', 'he', 'fa'];
  return rtlLanguages.includes(i18n.language);
};
