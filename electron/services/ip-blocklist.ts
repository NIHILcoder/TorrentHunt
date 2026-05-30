/**
 * IP Blocklist Service
 * Downloads and applies P2P IP blocklists to filter malicious/surveillance peers.
 * Applies via WebTorrent 'wire' events (best-effort, no full TCP-level filtering).
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import WebTorrent from 'webtorrent';
import { logger } from '../utils';
import * as db from '../db/store';

const log = logger.child('IPBlocklist');

interface IPRange {
  start: number;
  end: number;
}

export class IPBlocklistService {
  private ranges: IPRange[] = [];
  private appliedToClient = false;
  private clientRef: WebTorrent.Instance | null = null;

  get entryCount(): number {
    return this.ranges.length;
  }

  /**
   * Load all enabled blocklists from store and merge into in-memory ranges.
   */
  async loadAll(): Promise<void> {
    const blocklists = await db.getIPBlocklists();
    const enabled = blocklists.filter(b => b.enabled);

    const allRanges: IPRange[] = [];

    for (const bl of enabled) {
      const data = await db.getBlocklistData(bl.id);
      if (!data) continue;

      const parsed = this.parsePackedRanges(data);
      allRanges.push(...parsed);
    }

    // Sort ranges for binary search
    allRanges.sort((a, b) => a.start - b.start);
    this.ranges = allRanges;

    log.info(`Loaded ${this.ranges.length} blocked IP ranges from ${enabled.length} blocklists`);
  }

  /**
   * Download and parse a blocklist, save to store, reload.
   */
  async updateBlocklist(id: string): Promise<number> {
    const blocklists = await db.getIPBlocklists();
    const bl = blocklists.find(b => b.id === id);
    if (!bl) throw new Error(`Blocklist not found: ${id}`);

    log.info('Downloading IP blocklist', { name: bl.name, url: bl.url });

    const content = await this.fetchText(bl.url);
    const ranges = this.parseBlocklistContent(content);

    log.info(`Parsed ${ranges.length} ranges from blocklist`, { name: bl.name });

    // Pack and save
    const packed = this.packRanges(ranges);
    await db.saveBlocklistData(id, packed);
    await db.updateIPBlocklist(id, {
      lastUpdated: new Date().toISOString(),
      entryCount: ranges.length,
    });

    // Reload all
    await this.loadAll();

    return ranges.length;
  }

  isBlocked(ip: string): boolean {
    if (this.ranges.length === 0) return false;

    try {
      const ipNum = this.ipToNum(ip);
      // Binary search
      let lo = 0;
      let hi = this.ranges.length - 1;

      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const range = this.ranges[mid];

        if (ipNum < range.start) {
          hi = mid - 1;
        } else if (ipNum > range.end) {
          lo = mid + 1;
        } else {
          return true; // IP is in blocked range
        }
      }
    } catch (_) {
      // Malformed IP — don't block
    }

    return false;
  }

  /**
   * Apply blocklist filtering to a WebTorrent client instance.
   * Must be called after client is created.
   */
  applyToClient(client: WebTorrent.Instance): void {
    this.clientRef = client;
    this.appliedToClient = true;

    client.on('torrent', (torrent: any) => {
      torrent.on('wire', (wire: any) => {
        const peerIp = wire.remoteAddress;
        if (!peerIp) return;

        if (this.isBlocked(peerIp)) {
          log.debug('Blocked peer', { ip: peerIp });
          try { wire.destroy(); } catch (_) { /* ignore */ }
        }
      });
    });

    log.info('IP blocklist applied to WebTorrent client');
  }

  private parseBlocklistContent(content: string): IPRange[] {
    const ranges: IPRange[] = [];

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

      // Format: "Description:StartIP-EndIP" (DAT/P2P format)
      const datMatch = trimmed.match(/^[^:]*:(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)$/);
      if (datMatch) {
        try {
          ranges.push({
            start: this.ipToNum(datMatch[1]),
            end: this.ipToNum(datMatch[2]),
          });
        } catch (_) { continue; }
        continue;
      }

      // Format: "StartIP-EndIP" (plain range)
      const rangeMatch = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)$/);
      if (rangeMatch) {
        try {
          ranges.push({
            start: this.ipToNum(rangeMatch[1]),
            end: this.ipToNum(rangeMatch[2]),
          });
        } catch (_) { continue; }
        continue;
      }

      // Format: CIDR "192.168.0.0/16"
      const cidrMatch = trimmed.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
      if (cidrMatch) {
        try {
          const baseIp = this.ipToNum(cidrMatch[1]);
          const prefix = parseInt(cidrMatch[2]);
          const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
          const start = (baseIp & mask) >>> 0;
          const end = (start | (~mask >>> 0)) >>> 0;
          ranges.push({ start, end });
        } catch (_) { continue; }
      }
    }

    return ranges;
  }

  private ipToNum(ip: string): number {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      throw new Error(`Invalid IP: ${ip}`);
    }
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  private packRanges(ranges: IPRange[]): string {
    // Store as "start,end;start,end;..." for efficient storage
    return ranges.map(r => `${r.start},${r.end}`).join(';');
  }

  private parsePackedRanges(data: string): IPRange[] {
    if (!data) return [];
    return data.split(';').map(pair => {
      const [start, end] = pair.split(',').map(Number);
      return { start, end };
    }).filter(r => !isNaN(r.start) && !isNaN(r.end));
  }

  private async fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.get(url, {
        headers: { 'User-Agent': 'TorrentHunt/1.3.5 Blocklist' },
        timeout: 30000,
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.fetchText(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} fetching blocklist`));
          return;
        }
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Blocklist fetch timeout')); });
    });
  }
}

let ipBlocklistService: IPBlocklistService | null = null;

export function getIPBlocklistService(): IPBlocklistService {
  if (!ipBlocklistService) {
    ipBlocklistService = new IPBlocklistService();
  }
  return ipBlocklistService;
}
