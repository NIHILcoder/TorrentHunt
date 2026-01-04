/**
 * Batch Create Torrents Component
 * 
 * Create multiple torrents at once from a list of folders.
 */

import React, { useState, useCallback } from 'react';
import { Icon } from './Icon';
import { Button, ProgressBar } from '.';
import './BatchCreate.css';

interface BatchItem {
  id: string;
  path: string;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  result?: {
    torrentFilePath: string;
    infoHash: string;
  };
}

interface BatchCreateProps {
  isOpen: boolean;
  onClose: () => void;
  trackers: string;
  isPrivate: boolean;
  pieceLength: number;
  startSeeding: boolean;
  createdBy: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const BatchCreate: React.FC<BatchCreateProps> = ({
  isOpen,
  onClose,
  trackers,
  isPrivate,
  pieceLength,
  startSeeding,
  createdBy
}) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleAddFolders = useCallback(async () => {
    // Since we don't have selectMultipleFolders API yet, allow selecting one folder at a time
    const folder = await window.api.selectFolderForTorrent();
    if (!folder) return;

    const newItems: BatchItem[] = [];
    try {
      const info = await window.api.getPathInfo(folder);
      newItems.push({
        id: `${Date.now()}-${Math.random()}`,
        path: folder,
        name: info.name,
        size: info.size,
        status: 'pending'
      });
    } catch (err) {
      console.error('Failed to get folder info:', err);
    }

    setItems(prev => [...prev, ...newItems]);
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    if (!isProcessing) {
      setItems([]);
      setCurrentIndex(0);
    }
  }, [isProcessing]);

  const handleStartBatch = useCallback(async () => {
    if (items.length === 0) return;

    setIsProcessing(true);
    setCurrentIndex(0);

    // Parse trackers
    const announceList: string[][] = [];
    const trackerLines = trackers.split('\n').map(l => l.trim()).filter(l => l);
    for (const line of trackerLines) {
      if (line.startsWith('udp://') || line.startsWith('http://') || line.startsWith('https://')) {
        announceList.push([line]);
      }
    }

    // Process each item sequentially
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setCurrentIndex(i);

      setItems(prev => prev.map(it => 
        it.id === item.id ? { ...it, status: 'processing' as const, progress: 0 } : it
      ));

      try {
        // Create output path
        const outputDir = await window.api.selectSaveTorrentPath(`${item.name}`);
        if (!outputDir) {
          throw new Error('Output path not selected');
        }

        // Listen to progress
        const unsubscribe = window.api.onCreateTorrentProgress((progressUpdate) => {
          setItems(prev => prev.map(it => 
            it.id === item.id ? { ...it, progress: progressUpdate.progress } : it
          ));
        });

        // Create torrent
        const result = await window.api.createTorrent({
          sourcePaths: [item.path],
          outputPath: outputDir,
          options: {
            name: item.name,
            createdBy,
            announceList,
            private: isPrivate,
            pieceLength: pieceLength > 0 ? pieceLength : undefined,
          },
          startSeeding,
        });

        unsubscribe();

        setItems(prev => prev.map(it => 
          it.id === item.id 
            ? { 
                ...it, 
                status: 'completed' as const, 
                progress: 1,
                result: {
                  torrentFilePath: result.torrentFilePath,
                  infoHash: result.infoHash
                }
              } 
            : it
        ));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create torrent';
        setItems(prev => prev.map(it => 
          it.id === item.id 
            ? { ...it, status: 'failed' as const, error: errorMessage } 
            : it
        ));
      }
    }

    setIsProcessing(false);
  }, [items, trackers, isPrivate, pieceLength, startSeeding, createdBy]);

  if (!isOpen) return null;

  const completedCount = items.filter(it => it.status === 'completed').length;
  const failedCount = items.filter(it => it.status === 'failed').length;
  const totalSize = items.reduce((sum, it) => sum + it.size, 0);

  return (
    <div className="batch-create-overlay" onClick={isProcessing ? undefined : onClose}>
      <div className="batch-create-modal" onClick={(e) => e.stopPropagation()}>
        <div className="batch-header">
          <h3>
            <Icon name="layers" size={20} />
            Batch Create Torrents
          </h3>
          <button className="close-btn" onClick={onClose} disabled={isProcessing}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="batch-content">
          <div className="batch-stats">
            <div className="stat-card">
              <Icon name="folder" size={16} />
              <div className="stat-info">
                <span className="stat-label">Folders</span>
                <span className="stat-value">{items.length}</span>
              </div>
            </div>
            <div className="stat-card">
              <Icon name="hard-drive" size={16} />
              <div className="stat-info">
                <span className="stat-label">Total Size</span>
                <span className="stat-value">{formatBytes(totalSize)}</span>
              </div>
            </div>
            <div className="stat-card success">
              <Icon name="check-circle" size={16} />
              <div className="stat-info">
                <span className="stat-label">Completed</span>
                <span className="stat-value">{completedCount}</span>
              </div>
            </div>
            {failedCount > 0 && (
              <div className="stat-card error">
                <Icon name="x-circle" size={16} />
                <div className="stat-info">
                  <span className="stat-label">Failed</span>
                  <span className="stat-value">{failedCount}</span>
                </div>
              </div>
            )}
          </div>

          <div className="batch-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddFolders}
              disabled={isProcessing}
            >
              <Icon name="folder-plus" size={14} />
              Add Folders
            </Button>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                disabled={isProcessing}
              >
                <Icon name="trash" size={14} />
                Clear All
              </Button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="batch-empty">
              <Icon name="folder-open" size={48} />
              <h4>No folders added</h4>
              <p>Click "Add Folders" to select multiple folders to create torrents from</p>
            </div>
          ) : (
            <div className="batch-list">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`batch-item ${item.status} ${currentIndex === index && isProcessing ? 'current' : ''}`}
                >
                  <div className="item-icon">
                    {item.status === 'pending' && <Icon name="folder" size={20} />}
                    {item.status === 'processing' && <Icon name="loader" size={20} className="spinning" />}
                    {item.status === 'completed' && <Icon name="check-circle" size={20} />}
                    {item.status === 'failed' && <Icon name="x-circle" size={20} />}
                  </div>

                  <div className="item-info">
                    <div className="item-header">
                      <span className="item-name" title={item.name}>{item.name}</span>
                      <span className="item-size">{formatBytes(item.size)}</span>
                    </div>
                    
                    {item.status === 'processing' && item.progress !== undefined && (
                      <div className="item-progress">
                        <ProgressBar value={item.progress} size="sm" />
                        <span className="progress-text">{Math.round(item.progress * 100)}%</span>
                      </div>
                    )}
                    
                    {item.status === 'failed' && item.error && (
                      <div className="item-error">
                        <Icon name="alert-circle" size={12} />
                        {item.error}
                      </div>
                    )}
                    
                    {item.status === 'completed' && item.result && (
                      <div className="item-success">
                        <Icon name="check" size={12} />
                        Created successfully
                      </div>
                    )}
                  </div>

                  {!isProcessing && item.status === 'pending' && (
                    <button
                      className="item-remove"
                      onClick={() => handleRemoveItem(item.id)}
                      title="Remove"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="batch-footer">
          <Button variant="secondary" onClick={onClose} disabled={isProcessing}>
            {isProcessing ? 'Processing...' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            onClick={handleStartBatch}
            disabled={items.length === 0 || isProcessing}
          >
            <Icon name={isProcessing ? 'loader' : 'zap'} size={16} className={isProcessing ? 'spinning' : ''} />
            {isProcessing ? `Creating ${currentIndex + 1}/${items.length}...` : `Create ${items.length} Torrents`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BatchCreate;
