/**
 * Privacy Settings Component
 *
 * Advanced privacy controls for TorrentHunt
 */

import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { Toggle } from './Toggle';
import { Button } from './Button';
import { Alert } from './Alert';
import { PrivacyConfig, VPNDetectionResult } from '../../shared/types';
import { useTranslation } from '../utils/i18nContext';
import './PrivacySettings.css';

export const PrivacySettings: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<PrivacyConfig>({
    anonymousMode: true,
    encryptStorage: true,
    disableLogs: false,
    vpnCheck: true,
    clearDataOnExit: false,
    ephemeralPeerId: true,
    sanitizeLogs: true,
    vpnKillSwitch: false,
  });

  const [vpnStatus, setVpnStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [vpnDetails, setVpnDetails] = useState<VPNDetectionResult | null>(null);
  const [isCheckingVPN, setIsCheckingVPN] = useState(false);
  const [encryptionAvailable, setEncryptionAvailable] = useState(true);

  useEffect(() => {
    void loadPrivacySettings();
    void checkVPNStatus();
    void window.api.isEncryptionAvailable().then(setEncryptionAvailable).catch(() => {});
  }, []);

  const loadPrivacySettings = async () => {
    try {
      const settings = await window.api.getPrivacyConfig();
      setConfig(settings);
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
    }
  };

  const checkVPNStatus = async () => {
    setIsCheckingVPN(true);
    try {
      // Was incorrectly calling getPrivacyConfig(); use the real VPN detector
      const result = await window.api.checkVPN();
      setVpnDetails(result);
      setVpnStatus(result.isVPNActive ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Failed to check VPN status:', error);
      setVpnStatus('unknown');
    } finally {
      setIsCheckingVPN(false);
    }
  };

  const handleChange = async (key: keyof PrivacyConfig, value: boolean) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);

    try {
      await window.api.updatePrivacyConfig({ [key]: value });
    } catch (error) {
      console.error('Failed to save privacy setting:', error);
      // Revert on failure
      setConfig(config);
    }
  };

  const handleClearAllData = async () => {
    const confirmed = confirm(t('privacy.confirm1'));

    if (!confirmed) return;

    // Second confirmation
    const doubleConfirmed = confirm(t('privacy.confirm2'));

    if (!doubleConfirmed) return;

    try {
      await window.api.clearAllData();
      alert(t('privacy.cleared'));

      // Reload the page to reflect changes
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert(t('privacy.clearFailed'));
    }
  };

  return (
    <div className="privacy-settings">
      {/* Header */}
      <div className="settings-category-header">
        <h1 className="settings-category-title">🔒 {t('privacy.title')}</h1>
        <p className="settings-category-subtitle">
          {t('privacy.subtitle')}
        </p>
      </div>

      {/* VPN Status */}
      {vpnStatus === 'connected' && vpnDetails && (
        <Alert variant="success">
          <strong>✅ {t('privacy.vpn.detected')}</strong>
          <p>
            {vpnDetails.details.vpnProvider
              ? `${t('privacy.vpn.connectedVia')} ${vpnDetails.details.vpnProvider}`
              : t('privacy.vpn.connected')}
            {' '}({t('privacy.vpn.confidence')}: {vpnDetails.confidence})
          </p>
          {vpnDetails.details.detectedInterfaces.length > 0 && (
            <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
              {t('privacy.vpn.interfaces')}: {vpnDetails.details.detectedInterfaces.join(', ')}
            </p>
          )}
        </Alert>
      )}

      {vpnStatus === 'disconnected' && vpnDetails && (
        <Alert variant="warning">
          <strong>⚠️ {t('privacy.vpn.notDetected')}</strong>
          <p>{t('privacy.vpn.notDetectedDesc')}</p>
          {vpnDetails.details.publicIP && (
            <p style={{ fontSize: '0.85em', opacity: 0.8 }}>
              {t('privacy.vpn.yourIP')}: {vpnDetails.details.publicIP}
            </p>
          )}
          <Button
            variant="secondary"
            onClick={checkVPNStatus}
            disabled={isCheckingVPN}
            style={{ marginTop: '8px' }}
          >
            <Icon name="refresh-cw" size={14} />
            {isCheckingVPN ? t('privacy.vpn.checking') : t('privacy.vpn.recheck')}
          </Button>
        </Alert>
      )}

      {vpnStatus === 'unknown' && (
        <Alert variant="info">
          <strong>ℹ️ {t('privacy.vpn.unknown')}</strong>
          <p>{t('privacy.vpn.unknownDesc')}</p>
          <Button
            variant="secondary"
            onClick={checkVPNStatus}
            disabled={isCheckingVPN}
            style={{ marginTop: '8px' }}
          >
            <Icon name="refresh-cw" size={14} />
            {isCheckingVPN ? t('privacy.vpn.checking') : t('privacy.vpn.check')}
          </Button>
        </Alert>
      )}

      {/* Encryption Status */}
      {!encryptionAvailable && (
        <Alert variant="info">
          <strong>ℹ️ {t('privacy.enc.unavailable')}</strong>
          <p>{t('privacy.enc.unavailableDesc')}</p>
        </Alert>
      )}

      {/* Anonymity */}
      <div className="settings-group">
        <h3 className="settings-group-title">{t('privacy.grp.anonymity')}</h3>

        <div className="setting-item">
          <div className="setting-info">
            <label className="setting-label">
              <Icon name="refresh-cw" size={16} />
              {t('privacy.ephemeralId')}
            </label>
            <p className="setting-description">
              {t('privacy.ephemeralId.desc')}
            </p>
          </div>
          <div className="setting-control">
            <span className="privacy-status on"><Icon name="check-circle" size={14} /> {t('privacy.alwaysOn')}</span>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label className="setting-label">
              <Icon name="shield" size={16} />
              {t('privacy.vpnDetection')}
            </label>
            <p className="setting-description">
              {t('privacy.vpnDetection.desc')}
            </p>
          </div>
          <div className="setting-control">
            <Toggle
              checked={config.vpnCheck}
              onChange={(checked) => handleChange('vpnCheck', checked)}
            />
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label className="setting-label">
              <Icon name="shield" size={16} />
              {t('privacy.killSwitch')}
            </label>
            <p className="setting-description">
              {t('privacy.killSwitch.desc')}
            </p>
          </div>
          <div className="setting-control">
            <Toggle
              checked={config.vpnKillSwitch}
              onChange={(checked) => handleChange('vpnKillSwitch', checked)}
            />
          </div>
        </div>
      </div>

      {/* Data Protection */}
      <div className="settings-group">
        <h3 className="settings-group-title">{t('privacy.grp.dataProtection')}</h3>

        <div className="setting-item">
          <div className="setting-info">
            <label className="setting-label">
              <Icon name="lock" size={16} />
              {t('privacy.encSecrets')}
            </label>
            <p className="setting-description">
              {t('privacy.encSecrets.desc')}
            </p>
          </div>
          <div className="setting-control">
            {encryptionAvailable ? (
              <span className="privacy-status on"><Icon name="check-circle" size={14} /> {t('privacy.active')}</span>
            ) : (
              <span className="privacy-status off"><Icon name="alert-triangle" size={14} /> {t('privacy.unavailable')}</span>
            )}
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label className="setting-label">
              <Icon name="trash" size={16} />
              {t('privacy.clearOnExit')}
            </label>
            <p className="setting-description">
              {t('privacy.clearOnExit.desc')}
            </p>
          </div>
          <div className="setting-control">
            <Toggle
              checked={config.clearDataOnExit}
              onChange={(checked) => handleChange('clearDataOnExit', checked)}
            />
          </div>
        </div>
      </div>

      {/* Logging */}
      <div className="settings-group">
        <h3 className="settings-group-title">{t('privacy.grp.logging')}</h3>

        <div className="setting-item">
          <div className="setting-info">
            <label className="setting-label">
              <Icon name="file-text" size={16} />
              {t('privacy.sanitizeLogs')}
            </label>
            <p className="setting-description">
              {t('privacy.sanitizeLogs.desc')}
            </p>
          </div>
          <div className="setting-control">
            <Toggle
              checked={config.sanitizeLogs}
              onChange={(checked) => handleChange('sanitizeLogs', checked)}
            />
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <label className="setting-label">
              <Icon name="x-circle" size={16} />
              {t('privacy.disableLogs')}
            </label>
            <p className="setting-description">
              {t('privacy.disableLogs.desc')}
            </p>
          </div>
          <div className="setting-control">
            <Toggle
              checked={config.disableLogs}
              onChange={(checked) => handleChange('disableLogs', checked)}
            />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-group danger-zone">
        <h3 className="settings-group-title">⚠️ {t('privacy.grp.danger')}</h3>

        <div className="setting-item">
          <div className="setting-info">
            <label className="setting-label">
              <Icon name="alert-triangle" size={16} />
              {t('privacy.clearAll')}
            </label>
            <p className="setting-description">
              {t('privacy.clearAll.desc')}
            </p>
          </div>
          <div className="setting-control">
            <Button
              variant="danger"
              onClick={handleClearAllData}
            >
              <Icon name="trash" size={16} />
              {t('privacy.clearAll')}
            </Button>
          </div>
        </div>
      </div>

      {/* Privacy Tips */}
      <div className="privacy-tips">
        <h3>💡 {t('privacy.tips.title')}</h3>
        <ul>
          <li><strong>{t('privacy.tips.vpn')}</strong> {t('privacy.tips.vpnText')}</li>
          <li><strong>{t('privacy.tips.bind')}</strong> {t('privacy.tips.bindText')}</li>
          <li><strong>{t('privacy.tips.webrtc')}</strong> {t('privacy.tips.webrtcText')}</li>
          <li><strong>{t('privacy.tips.private')}</strong> {t('privacy.tips.privateText')}</li>
          <li><strong>{t('privacy.tips.check')}</strong> {t('privacy.tips.checkText')}</li>
        </ul>
      </div>

      {/* Privacy Score */}
      <div className="privacy-score">
        <h3>{t('privacy.score')}</h3>
        <div className="score-bar">
          <div
            className="score-fill"
            style={{
              width: `${calculatePrivacyScore(config, vpnStatus)}%`,
              backgroundColor: getScoreColor(calculatePrivacyScore(config, vpnStatus))
            }}
          />
        </div>
        <div className="score-label">
          {calculatePrivacyScore(config, vpnStatus)}/100 - {t(getScoreLabelKey(calculatePrivacyScore(config, vpnStatus)))}
        </div>
      </div>
    </div>
  );
};

function calculatePrivacyScore(config: PrivacyConfig, vpnStatus: string): number {
  let score = 0;

  // Always-on protections (encrypted secrets + ephemeral peer id)
  score += 25;
  // VPN is the biggest factor for real network anonymity
  if (vpnStatus === 'connected') score += 45;
  // Opt-in hygiene
  if (config.sanitizeLogs) score += 12;
  if (config.clearDataOnExit) score += 10;
  if (config.disableLogs) score += 8;

  return Math.min(100, score);
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // Green
  if (score >= 60) return '#f59e0b'; // Orange
  return '#ef4444'; // Red
}

type ScoreLabelKey = 'privacy.score.excellent' | 'privacy.score.good' | 'privacy.score.fair' | 'privacy.score.poor';

function getScoreLabelKey(score: number): ScoreLabelKey {
  if (score >= 80) return 'privacy.score.excellent';
  if (score >= 60) return 'privacy.score.good';
  if (score >= 40) return 'privacy.score.fair';
  return 'privacy.score.poor';
}
