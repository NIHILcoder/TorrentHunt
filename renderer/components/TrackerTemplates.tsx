/**
 * Tracker Templates Component
 * 
 * Provides preset tracker lists for different content types.
 */

import React, { useState } from 'react';
import { Icon } from './Icon';
import './TrackerTemplates.css';

export interface TrackerTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  trackers: string[];
}

const DEFAULT_TEMPLATES: TrackerTemplate[] = [
  {
    id: 'public',
    name: 'Public Trackers',
    description: 'Popular public torrent trackers',
    icon: 'globe',
    trackers: [
      'udp://tracker.opentrackr.org:1337/announce',
      'udp://open.demonii.com:1337/announce',
      'udp://tracker.openbittorrent.com:6969/announce',
      'udp://exodus.desync.com:6969/announce',
      'udp://tracker.torrent.eu.org:451/announce',
      'udp://tracker.moeking.me:6969/announce',
      'udp://explodie.org:6969/announce',
      'udp://tracker1.bt.moack.co.kr:80/announce',
      'udp://tracker.theoks.net:6969/announce',
      'http://tracker.openbittorrent.com:80/announce',
    ]
  },
  {
    id: 'anime',
    name: 'Anime Trackers',
    description: 'Specialized trackers for anime content',
    icon: 'tv',
    trackers: [
      'http://nyaa.tracker.wf:7777/announce',
      'udp://open.stealth.si:80/announce',
      'udp://tracker.opentrackr.org:1337/announce',
      'udp://exodus.desync.com:6969/announce',
      'udp://tracker.torrent.eu.org:451/announce',
    ]
  },
  {
    id: 'games',
    name: 'Game Trackers',
    description: 'Trackers for game distributions',
    icon: 'gamepad-2',
    trackers: [
      'udp://tracker.opentrackr.org:1337/announce',
      'udp://tracker.openbittorrent.com:6969/announce',
      'udp://open.stealth.si:80/announce',
      'udp://exodus.desync.com:6969/announce',
      'udp://tracker.torrent.eu.org:451/announce',
      'udp://tracker.moeking.me:6969/announce',
    ]
  },
  {
    id: 'software',
    name: 'Software Trackers',
    description: 'Trackers for software and tools',
    icon: 'package',
    trackers: [
      'udp://tracker.opentrackr.org:1337/announce',
      'udp://open.demonii.com:1337/announce',
      'udp://tracker.openbittorrent.com:6969/announce',
      'udp://exodus.desync.com:6969/announce',
      'udp://tracker.torrent.eu.org:451/announce',
    ]
  },
  {
    id: 'music',
    name: 'Music Trackers',
    description: 'Trackers for music sharing',
    icon: 'music',
    trackers: [
      'udp://tracker.opentrackr.org:1337/announce',
      'udp://open.demonii.com:1337/announce',
      'udp://tracker.openbittorrent.com:6969/announce',
      'udp://exodus.desync.com:6969/announce',
      'udp://tracker.torrent.eu.org:451/announce',
      'udp://tracker.moeking.me:6969/announce',
    ]
  },
  {
    id: 'private',
    name: 'Private Only',
    description: 'Empty list for private trackers',
    icon: 'lock',
    trackers: []
  }
];

interface TrackerTemplatesProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (trackers: string[]) => void;
  customTemplates?: TrackerTemplate[];
}

export const TrackerTemplates: React.FC<TrackerTemplatesProps> = ({
  isOpen,
  onClose,
  onSelect,
  customTemplates = []
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  if (!isOpen) return null;

  const handleSelect = (template: TrackerTemplate) => {
    setSelectedTemplate(template.id);
    setTimeout(() => {
      onSelect(template.trackers);
      onClose();
      setSelectedTemplate(null);
    }, 200);
  };

  return (
    <div className="tracker-templates-overlay" onClick={onClose}>
      <div className="tracker-templates-modal" onClick={(e) => e.stopPropagation()}>
        <div className="templates-header">
          <h3>
            <Icon name="server" size={20} />
            Tracker Templates
          </h3>
          <button className="close-btn" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="templates-content">
          <p className="templates-description">
            Choose a preset tracker list for your torrent type
          </p>

          <div className="templates-grid">
            {allTemplates.map((template) => (
              <button
                key={template.id}
                className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                onClick={() => handleSelect(template)}
              >
                <div className="template-icon">
                  <Icon name={template.icon as any} size={32} />
                </div>
                <div className="template-info">
                  <h4 className="template-name">{template.name}</h4>
                  <p className="template-description">{template.description}</p>
                  <span className="template-count">
                    {template.trackers.length} {template.trackers.length === 1 ? 'tracker' : 'trackers'}
                  </span>
                </div>
                {selectedTemplate === template.id && (
                  <div className="template-check">
                    <Icon name="check" size={16} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackerTemplates;
