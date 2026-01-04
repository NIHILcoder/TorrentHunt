/**
 * Torrent Metadata Preview Component
 * 
 * Shows final torrent metadata before creation.
 */

import React from 'react';
import { Icon } from './Icon';
import './MetadataPreview.css';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface MetadataPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  metadata: {
    name: string;
    comment?: string;
    totalSize: number;
    fileCount: number;
    pieceSize: number;
    pieceCount: number;
    trackers: string[];
    webSeeds?: string[];
    isPrivate: boolean;
    createdBy: string;
    estimatedTorrentSize: number;
  };
}

export const MetadataPreview: React.FC<MetadataPreviewProps> = ({
  isOpen,
  onClose,
  onConfirm,
  metadata
}) => {
  if (!isOpen) return null;

  return (
    <div className="metadata-preview-overlay" onClick={onClose}>
      <div className="metadata-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>
            <Icon name="eye" size={20} />
            Torrent Metadata Preview
          </h3>
          <button className="close-btn" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="preview-content">
          <p className="preview-description">
            Review the final torrent metadata before creation
          </p>

          <div className="metadata-section">
            <h4 className="section-title">
              <Icon name="info" size={16} />
              Basic Information
            </h4>
            <div className="metadata-grid">
              <div className="metadata-item">
                <span className="item-label">Name</span>
                <span className="item-value">{metadata.name}</span>
              </div>
              {metadata.comment && (
                <div className="metadata-item full-width">
                  <span className="item-label">Description</span>
                  <span className="item-value description">{metadata.comment}</span>
                </div>
              )}
              <div className="metadata-item">
                <span className="item-label">Created By</span>
                <span className="item-value">{metadata.createdBy}</span>
              </div>
              <div className="metadata-item">
                <span className="item-label">Privacy</span>
                <span className={`item-value badge ${metadata.isPrivate ? 'private' : 'public'}`}>
                  <Icon name={metadata.isPrivate ? 'lock' : 'globe'} size={12} />
                  {metadata.isPrivate ? 'Private' : 'Public'}
                </span>
              </div>
            </div>
          </div>

          <div className="metadata-section">
            <h4 className="section-title">
              <Icon name="hard-drive" size={16} />
              Content Information
            </h4>
            <div className="metadata-grid">
              <div className="metadata-item">
                <span className="item-label">Total Size</span>
                <span className="item-value mono">{formatBytes(metadata.totalSize)}</span>
              </div>
              <div className="metadata-item">
                <span className="item-label">Files</span>
                <span className="item-value">{metadata.fileCount} {metadata.fileCount === 1 ? 'file' : 'files'}</span>
              </div>
              <div className="metadata-item">
                <span className="item-label">Piece Size</span>
                <span className="item-value mono">{formatBytes(metadata.pieceSize)}</span>
              </div>
              <div className="metadata-item">
                <span className="item-label">Pieces</span>
                <span className="item-value">{metadata.pieceCount.toLocaleString()}</span>
              </div>
              <div className="metadata-item">
                <span className="item-label">.torrent Size</span>
                <span className="item-value mono">~{formatBytes(metadata.estimatedTorrentSize)}</span>
              </div>
            </div>
          </div>

          <div className="metadata-section">
            <h4 className="section-title">
              <Icon name="server" size={16} />
              Trackers ({metadata.trackers.length})
            </h4>
            {metadata.trackers.length > 0 ? (
              <div className="tracker-list">
                {metadata.trackers.slice(0, 5).map((tracker, idx) => (
                  <div key={idx} className="tracker-item">
                    <Icon name="circle" size={6} />
                    <span>{tracker}</span>
                  </div>
                ))}
                {metadata.trackers.length > 5 && (
                  <div className="tracker-more">
                    + {metadata.trackers.length - 5} more trackers
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-notice">
                <Icon name="alert-circle" size={14} />
                No trackers configured
              </div>
            )}
          </div>

          {metadata.webSeeds && metadata.webSeeds.length > 0 && (
            <div className="metadata-section">
              <h4 className="section-title">
                <Icon name="external-link" size={16} />
                Web Seeds ({metadata.webSeeds.length})
              </h4>
              <div className="tracker-list">
                {metadata.webSeeds.map((seed, idx) => (
                  <div key={idx} className="tracker-item">
                    <Icon name="circle" size={6} />
                    <span>{seed}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="info-notice">
            <Icon name="info" size={16} />
            <span>
              This preview shows the final metadata that will be written to the .torrent file.
              Make sure everything looks correct before proceeding.
            </span>
          </div>
        </div>

        <div className="preview-footer">
          <button className="btn-secondary" onClick={onClose}>
            <Icon name="arrow-left" size={16} />
            Go Back
          </button>
          <button className="btn-primary" onClick={onConfirm}>
            <Icon name="check" size={16} />
            Looks Good, Create Torrent
          </button>
        </div>
      </div>
    </div>
  );
};

export default MetadataPreview;
