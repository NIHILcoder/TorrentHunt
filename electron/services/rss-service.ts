/**
 * RSS Service
 * Manages RSS feed subscriptions, polling, and auto-download of new torrent items.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { logger } from '../utils';
import * as db from '../db/store';
import { RSSFeed, RSSItem } from '../../shared/types';
import { getTorrentManager } from '../torrent/manager';

const log = logger.child('RSSService');

export class RSSService {
  private checkTimers: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const feeds = await db.getRSSFeeds();
    log.info(`Initializing RSS service with ${feeds.length} feeds`);

    for (const feed of feeds) {
      if (feed.enabled) {
        this.scheduleCheck(feed);
      }
    }
  }

  private scheduleCheck(feed: RSSFeed): void {
    // Clear existing timer
    this.clearTimer(feed.id);

    const intervalMs = (feed.intervalMinutes || 30) * 60 * 1000;

    const timer = setInterval(async () => {
      try {
        await this.checkFeed(feed.id);
      } catch (err) {
        log.error('RSS feed check failed', { feedId: feed.id, error: err });
      }
    }, intervalMs);

    this.checkTimers.set(feed.id, timer);
    log.debug('Scheduled RSS feed check', { feedId: feed.id, intervalMinutes: feed.intervalMinutes });
  }

  private clearTimer(feedId: string): void {
    const existing = this.checkTimers.get(feedId);
    if (existing) {
      clearInterval(existing);
      this.checkTimers.delete(feedId);
    }
  }

  async addFeed(feedData: Omit<RSSFeed, 'id'>): Promise<RSSFeed> {
    const feed = await db.addRSSFeed(feedData);
    if (feed.enabled) {
      this.scheduleCheck(feed);
      // Check immediately on add
      this.checkFeed(feed.id).catch(err => {
        log.error('Initial RSS feed check failed', { feedId: feed.id, error: err });
      });
    }
    return feed;
  }

  async updateFeed(id: string, updates: Partial<RSSFeed>): Promise<RSSFeed> {
    const feed = await db.updateRSSFeed(id, updates);
    // Reschedule if enabled state or interval changed
    if (feed.enabled) {
      this.scheduleCheck(feed);
    } else {
      this.clearTimer(id);
    }
    return feed;
  }

  async removeFeed(id: string): Promise<void> {
    this.clearTimer(id);
    await db.removeRSSFeed(id);
  }

  async checkFeed(feedId: string): Promise<RSSItem[]> {
    const feeds = await db.getRSSFeeds();
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) throw new Error(`RSS feed not found: ${feedId}`);

    log.info('Checking RSS feed', { name: feed.name, url: feed.url });

    const xml = await this.fetchURL(feed.url);
    const items = this.parseRSS(xml, feedId);

    // Apply filter if set
    const filtered = feed.filter ? this.filterItems(items, feed.filter) : items;

    // Save new items
    await db.saveRSSItems(filtered);

    // Update lastChecked
    await db.updateRSSFeed(feedId, { lastChecked: new Date().toISOString() });

    // Auto-download if enabled
    if (feed.autoDownload) {
      await this.autoDownload(feed, filtered);
    }

    log.info('RSS feed checked', { name: feed.name, newItems: filtered.length });
    return filtered;
  }

  async checkAllFeeds(): Promise<void> {
    const feeds = await db.getRSSFeeds();
    const enabled = feeds.filter(f => f.enabled);
    log.info(`Checking all ${enabled.length} enabled RSS feeds`);
    await Promise.allSettled(enabled.map(f => this.checkFeed(f.id)));
  }

  private async fetchURL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.get(url, {
        headers: {
          'User-Agent': 'TorrentHunt/1.3.5 RSS Reader',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        timeout: 15000,
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          this.fetchURL(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} fetching RSS feed`));
          return;
        }

        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('RSS fetch timeout'));
      });
    });
  }

  private parseRSS(xml: string, feedId: string): RSSItem[] {
    const items: RSSItem[] = [];

    try {
      // Simple regex-based RSS parser (no external deps needed)
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let itemMatch;

      while ((itemMatch = itemRegex.exec(xml)) !== null) {
        const itemXml = itemMatch[1];

        const title = this.extractTag(itemXml, 'title') || 'Untitled';
        const guid = this.extractTag(itemXml, 'guid') || this.extractTag(itemXml, 'link') || title;
        const pubDate = this.extractTag(itemXml, 'pubDate');

        // Extract magnet or torrent link from various RSS formats
        let link = '';

        // Try enclosure first (common in torrent RSS)
        const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i);
        if (enclosureMatch) {
          link = enclosureMatch[1];
        }

        // Try torrent:magnetURI (Torrentz2, etc.)
        if (!link) {
          link = this.extractTag(itemXml, 'torrent:magnetURI') || '';
        }

        // Try link tag
        if (!link) {
          link = this.extractTag(itemXml, 'link') || '';
        }

        // Try comments or description for magnet links
        if (!link || (!link.startsWith('magnet:') && !link.endsWith('.torrent'))) {
          const desc = this.extractTag(itemXml, 'description') || '';
          const magnetMatch = desc.match(/magnet:\?[^\s"<>]+/);
          if (magnetMatch) link = magnetMatch[0];
        }

        if (!link) continue; // Skip items without downloadable link

        // Extract size from enclosure or torrent:contentLength
        let size: number | undefined;
        const enclosureLengthMatch = itemXml.match(/<enclosure[^>]*length="(\d+)"/i);
        if (enclosureLengthMatch) size = parseInt(enclosureLengthMatch[1]);
        const contentLength = this.extractTag(itemXml, 'torrent:contentLength');
        if (contentLength) size = parseInt(contentLength);

        items.push({
          guid: String(guid),
          title: this.decodeHTMLEntities(title),
          link,
          pubDate: pubDate || undefined,
          downloaded: false,
          size,
          feedId,
        });
      }
    } catch (err) {
      log.error('RSS parse error', { error: err });
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string | null {
    // Handle CDATA
    const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
    const cdataMatch = xml.match(cdataRegex);
    if (cdataMatch) return cdataMatch[1].trim();

    // Handle normal tag
    const normalRegex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
    const normalMatch = xml.match(normalRegex);
    if (normalMatch) return normalMatch[1].trim();

    return null;
  }

  private decodeHTMLEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private filterItems(items: RSSItem[], filter: string): RSSItem[] {
    try {
      const regex = new RegExp(filter, 'i');
      return items.filter(item => regex.test(item.title));
    } catch (err) {
      log.warn('Invalid RSS filter regex', { filter, error: err });
      return items;
    }
  }

  private async autoDownload(feed: RSSFeed, items: RSSItem[]): Promise<void> {
    const existingItems = await db.getRSSItems(feed.id);
    const downloadedGuids = new Set(existingItems.filter(i => i.downloaded).map(i => i.guid));

    const manager = getTorrentManager();

    for (const item of items) {
      if (downloadedGuids.has(item.guid)) continue;

      try {
        const isMagnet = item.link.startsWith('magnet:');
        await manager.addDownload({
          sourceType: isMagnet ? 'magnet' : 'torrent_file',
          sourceUri: item.link,
          name: item.title,
          savePath: feed.savePath,
        });

        await db.markRSSItemDownloaded(item.guid);
        log.info('RSS auto-downloaded', { title: item.title, feedName: feed.name });
      } catch (err: any) {
        if (err?.code !== 'DUPLICATE') {
          log.error('RSS auto-download failed', { title: item.title, error: err });
        }
      }
    }
  }

  destroy(): void {
    for (const [id] of this.checkTimers) {
      this.clearTimer(id);
    }
    log.info('RSS service destroyed');
  }
}

let rssService: RSSService | null = null;

export function getRSSService(): RSSService {
  if (!rssService) {
    rssService = new RSSService();
  }
  return rssService;
}
