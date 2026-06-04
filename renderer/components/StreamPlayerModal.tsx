/**
 * StreamPlayerModal
 *
 * In-app player that streams a media file straight from a torrent via the local
 * WebTorrent HTTP server — playback starts while the torrent is still
 * downloading (sequential, on demand).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from './Icon';
import { useTranslation } from '../utils/i18nContext';
import { classifyMediaKind, MediaKind } from '../../shared/media';
import './StreamPlayerModal.css';

interface StreamFile {
  index: number;
  name: string;
  length: number;
  kind: MediaKind;
}

interface StreamPlayerModalProps {
  downloadId: string;
  downloadName: string;
  onClose: () => void;
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const StreamPlayerModal: React.FC<StreamPlayerModalProps> = ({ downloadId, downloadName, onClose }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<StreamFile[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<MediaKind>('video');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the streamable files in this torrent once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await window.api.getTorrentFiles(downloadId);
        const streamable: StreamFile[] = all
          .map((f, index) => ({ index, name: f.name, length: f.length, kind: classifyMediaKind(f.name) }))
          .filter((f) => f.kind !== 'other')
          .sort((a, b) => b.length - a.length);
        if (cancelled) return;
        setFiles(streamable);
        if (streamable.length === 0) {
          setError(t('player.noMedia'));
          setLoading(false);
        } else {
          setActiveIndex(streamable[0].index);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || String(err));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [downloadId, t]);

  // Resolve a stream URL whenever the active file changes.
  useEffect(() => {
    if (activeIndex === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStreamUrl(null);
    (async () => {
      try {
        const info = await window.api.getStreamUrl(downloadId, activeIndex);
        if (cancelled) return;
        setStreamUrl(info.url);
        setKind(info.kind === 'other' ? 'video' : info.kind);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || String(err));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [downloadId, activeIndex]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeFile = files.find((f) => f.index === activeIndex) || null;

  const renderBody = useCallback(() => {
    if (error) {
      return (
        <div className="player-message">
          <Icon name="alert-triangle" size={32} />
          <p>{error}</p>
        </div>
      );
    }
    if (loading || !streamUrl) {
      return (
        <div className="player-message">
          <span className="spinner spinner-lg" />
          <p>{t('player.buffering')}</p>
        </div>
      );
    }
    if (kind === 'audio') {
      return (
        <div className="player-audio">
          <Icon name="music" size={64} />
          <div className="player-audio-name">{activeFile?.name}</div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={streamUrl} controls autoPlay />
        </div>
      );
    }
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={streamUrl}
        controls
        autoPlay
        className="player-video"
        onError={() => setError(t('player.unsupported'))}
      />
    );
  }, [error, loading, streamUrl, kind, activeFile, t]);

  return (
    <div className="player-overlay" onClick={onClose}>
      <div className="player-modal" onClick={(e) => e.stopPropagation()}>
        <div className="player-header">
          <div className="player-title" title={activeFile?.name || downloadName}>
            <Icon name={kind === 'audio' ? 'music' : 'play'} size={16} />
            <span>{activeFile?.name || downloadName}</span>
          </div>
          <button className="player-close" onClick={onClose} title={t('player.close')}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="player-body">{renderBody()}</div>

        {files.length > 1 && (
          <div className="player-files">
            {files.map((f) => (
              <button
                key={f.index}
                className={`player-file-chip ${f.index === activeIndex ? 'active' : ''}`}
                onClick={() => setActiveIndex(f.index)}
                title={f.name}
              >
                <Icon name={f.kind === 'audio' ? 'music' : 'film'} size={12} />
                <span className="player-file-name">{f.name}</span>
                <span className="player-file-size">{formatBytes(f.length)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="player-note">
          <Icon name="info" size={12} />
          <span>{t('player.note')}</span>
        </div>
      </div>
    </div>
  );
};

export default StreamPlayerModal;
