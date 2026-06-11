import React, { useEffect, useRef, useState } from 'react';
import { Icon, IconName } from './Icon';
import { useTranslation } from '../utils/i18nContext';
import './AppStatistics.css';

interface AppStatisticsProps {
  totalDownloads: number;
  totalUploaded: string;
  totalDownloaded: string;
  cacheSize: string;
  diskUsage: string;
  uptime: string;
}

// Split a formatted stat ("14.9 GB", "7", "0 B") into an animatable number and
// a trailing suffix. Non-numeric values ("-", "0h 0m") are returned as-is and
// shown statically.
function parseStat(value: string | number): { num: number; suffix: string; decimals: number } | null {
  const s = String(value).trim();
  const m = s.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  // Don't count-up compound time strings like "3h 12m".
  if (/\d\s*[hm]\b/i.test(s) && /h|m/i.test(m[2])) return null;
  const decimals = m[1].includes('.') ? m[1].split('.')[1].length : 0;
  return { num: parseFloat(m[1]), suffix: m[2], decimals };
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Count a number up from 0 → target with eased rAF animation. */
function useCountUp(target: number, decimals: number, durationMs = 1100, enabled = true): number {
  const [val, setVal] = useState(enabled ? 0 : target);
  const rafRef = useRef<number>();
  useEffect(() => {
    if (!enabled) { setVal(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(p);
      const factor = Math.pow(10, decimals);
      setVal(Math.round(target * eased * factor) / factor);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, decimals, durationMs, enabled]);
  return val;
}

const StatValue: React.FC<{ value: string | number }> = ({ value }) => {
  const parsed = parseStat(value);
  const animated = useCountUp(parsed?.num ?? 0, parsed?.decimals ?? 0, 1100, !!parsed);
  if (!parsed) return <>{value}</>;
  return <>{animated.toFixed(parsed.decimals)}{parsed.suffix}</>;
};

interface StatDef {
  key: string;
  icon: IconName;
  label: string;
  value: string | number;
}

export const AppStatistics: React.FC<AppStatisticsProps> = ({
  totalDownloads,
  totalUploaded,
  totalDownloaded,
  cacheSize,
  diskUsage,
  uptime,
}) => {
  const { t } = useTranslation();

  const stats: StatDef[] = [
    { key: 'total', icon: 'download', label: t('stats.totalDownloads'), value: totalDownloads },
    { key: 'down', icon: 'arrow-down', label: t('stats.downloaded'), value: totalDownloaded },
    { key: 'up', icon: 'arrow-up', label: t('stats.uploaded'), value: totalUploaded },
    { key: 'cache', icon: 'database', label: t('stats.cache'), value: cacheSize },
    { key: 'disk', icon: 'hard-drive', label: t('stats.diskUsage'), value: diskUsage },
    { key: 'uptime', icon: 'clock', label: t('stats.uptime'), value: uptime },
  ];

  return (
    <div className="app-statistics">
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div
            key={s.key}
            className="stat-card"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="stat-sheen" />
            <div className="stat-icon"><Icon name={s.icon} size={20} /></div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value"><StatValue value={s.value} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
