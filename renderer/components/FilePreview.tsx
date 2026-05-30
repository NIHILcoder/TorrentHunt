import React, { useEffect, useState } from 'react';
import { TorrentFile } from '../../shared/types';
import { Icon, IconName } from './Icon';
import './FilePreview.css';

interface FilePreviewProps {
  downloadId: string;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ downloadId, onClose }) => {
  const [files, setFiles] = useState<TorrentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        const fileList = await window.api.getTorrentFiles(downloadId);
        setFiles(fileList);
      } catch (err) {
        setError('Failed to load files');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadFiles();
  }, [downloadId]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = React.useMemo(() => {
    const iconCache = new Map<string, IconName>();
    return (fileName: string): IconName => {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      if (iconCache.has(ext)) return iconCache.get(ext)!;
      let icon: IconName = 'file';
      if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) icon = 'film';
      else if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) icon = 'music';
      else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) icon = 'image';
      else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) icon = 'archive';
      else if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) icon = 'file-text';
      iconCache.set(ext, icon);
      return icon;
    };
  }, []);

  const getFileTypeColor = React.useMemo(() => {
    const colorCache = new Map<string, string>();
    return (fileName: string): string => {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      if (colorCache.has(ext)) return colorCache.get(ext)!;
      let color = 'var(--color-text-tertiary)';
      if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) color = 'var(--color-video)';
      else if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) color = 'var(--color-audio)';
      else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) color = 'var(--color-image)';
      else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) color = 'var(--color-archive)';
      else if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) color = 'var(--color-document)';
      colorCache.set(ext, color);
      return color;
    };
  }, []);

  const getFileExtension = (fileName: string): string => {
    return fileName.split('.').pop()?.toUpperCase() || 'FILE';
  };

  if (loading) {
    return (
      <div className="file-preview-overlay">
        <div className="file-preview-modal">
          <div className="file-preview-loading">
            <div className="fp-spinner"></div>
            <p>Loading files...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-preview-overlay" onClick={onClose}>
        <div className="file-preview-modal" onClick={e => e.stopPropagation()}>
          <div className="file-preview-error">
            <div className="fp-state-icon fp-state-icon--error">
              <Icon name="alert-circle" size={32} />
            </div>
            <p>{error}</p>
            <button onClick={onClose} className="fp-close-action">Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="file-preview-overlay" onClick={onClose}>
        <div className="file-preview-modal" onClick={e => e.stopPropagation()}>
          <div className="file-preview-empty">
            <div className="fp-state-icon">
              <Icon name="inbox" size={32} />
            </div>
            <p>No files information available</p>
          </div>
        </div>
      </div>
    );
  }

  const totalSize = files.reduce((sum, file) => sum + file.length, 0);
  const downloadedSize = files.reduce((sum, file) => sum + file.downloaded, 0);
  const totalProgress = totalSize > 0 ? downloadedSize / totalSize : 0;
  const completedCount = files.filter(f => f.progress === 1).length;

  return (
    <div className="file-preview-overlay" onClick={onClose}>
      <div className="file-preview-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="fp-header">
          <div className="fp-header-left">
            <div className="fp-header-icon">
              <Icon name="layers" size={18} />
            </div>
            <div className="fp-header-text">
              <h3 className="fp-title">Files ({files.length})</h3>
              <div className="fp-subtitle">
                <span className="fp-chip">
                  <Icon name="hard-drive" size={12} />
                  {formatBytes(totalSize)}
                </span>
                <span className="fp-chip-sep">·</span>
                <span className="fp-chip">
                  <Icon name="download" size={12} />
                  {formatBytes(downloadedSize)} downloaded
                </span>
                <span className="fp-chip-sep">·</span>
                <span className="fp-chip fp-chip--progress">
                  {(totalProgress * 100).toFixed(1)}% complete
                </span>
                {completedCount > 0 && (
                  <>
                    <span className="fp-chip-sep">·</span>
                    <span className="fp-chip fp-chip--done">
                      <Icon name="check-circle" size={12} />
                      {completedCount} done
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="fp-close">
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* ── Overall progress bar ── */}
        <div className="fp-total-progress">
          <div className="fp-total-bar">
            <div
              className="fp-total-fill"
              style={{ width: `${totalProgress * 100}%` }}
            />
          </div>
        </div>

        {/* ── File list ── */}
        <div className="fp-list">
          {files.map((file, index) => {
            const pct = Math.round(file.progress * 100);
            const isDone = file.progress === 1;
            const ext = getFileExtension(file.name);

            return (
              <div key={index} className={`fp-item ${isDone ? 'fp-item--done' : ''}`}>
                {/* Icon */}
                <div className="fp-item-icon" style={{ color: getFileTypeColor(file.name) }}>
                  <Icon name={getFileIcon(file.name)} size={22} />
                  <span className="fp-ext-badge">{ext}</span>
                </div>

                {/* Content */}
                <div className="fp-item-body">
                  {/* Row 1: name + size */}
                  <div className="fp-item-row">
                    <span className="fp-item-name" title={file.path}>{file.name}</span>
                    <span className="fp-item-size">{formatBytes(file.length)}</span>
                  </div>

                  {/* Row 2: path */}
                  {file.path && file.path !== file.name && (
                    <div className="fp-item-path" title={file.path}>
                      <Icon name="folder" size={11} />
                      {file.path}
                    </div>
                  )}

                  {/* Row 3: progress bar */}
                  <div className="fp-item-progress-track">
                    <div
                      className={`fp-item-progress-fill ${isDone ? 'fp-item-progress-fill--done' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Row 4: percent + downloaded/total */}
                  <div className="fp-item-meta">
                    <span className="fp-item-pct">{pct}%</span>
                    {isDone ? (
                      <span className="fp-item-status fp-item-status--done">
                        <Icon name="check-circle" size={12} />
                        Completed
                      </span>
                    ) : (
                      <span className="fp-item-status">
                        <Icon name="download" size={12} />
                        {formatBytes(file.downloaded)} / {formatBytes(file.length)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
