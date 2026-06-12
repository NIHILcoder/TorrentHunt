/**
 * Search Service
 * Plugin-based torrent search using Jackett/Torznab/Custom providers.
 * Users configure their own providers — no hardcoded tracker URLs.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { app } from 'electron';
import { logger } from '../utils';
import * as db from '../db/store';
import { SearchProvider, SearchResult } from '../../shared/types';

const log = logger.child('SearchService');

export class SearchService {

  async search(query: string, category?: string): Promise<SearchResult[]> {
    const providers = await db.getSearchProviders();
    const enabled = providers.filter(p => p.enabled);

    if (enabled.length === 0) {
      log.info('No search providers configured');
      return [];
    }

    log.info('Searching', { query, category, providers: enabled.length });

    const results = await Promise.allSettled(
      enabled.map(p => this.searchProvider(p, query, category))
    );

    const allResults: SearchResult[] = [];
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        // Resilient aggregate: one bad provider shouldn't fail the whole search
        log.warn('Provider search failed', {
          provider: enabled[idx]?.name,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    });

    // Sort by seeds descending
    allResults.sort((a, b) => b.seeds - a.seeds);
    log.info(`Search complete: ${allResults.length} results`);
    return allResults;
  }

  async testProvider(id: string): Promise<{ success: boolean; message: string }> {
    const providers = await db.getSearchProviders();
    const provider = providers.find(p => p.id === id);
    if (!provider) return { success: false, message: 'Provider not found' };

    try {
      await this.searchProvider(provider, 'test', undefined);
      return { success: true, message: 'Provider is working correctly' };
    } catch (err: any) {
      return { success: false, message: err?.message || String(err) };
    }
  }

  private async searchProvider(provider: SearchProvider, query: string, category?: string): Promise<SearchResult[]> {
    switch (provider.type) {
      case 'jackett':
        return this.searchJackett(provider, query, category);
      case 'torznab':
        return this.searchTorznab(provider, query, category);
      case 'custom':
        return this.searchCustom(provider, query, category);
      default:
        // 'archive' (Internet Archive) was removed: archive.org disabled public
        // .torrent downloads in late 2024 (HTTP 401), so it can't serve torrents.
        return [];
    }
  }

  /**
   * Jackett API — https://github.com/Jackett/Jackett
   * GET /api/v2.0/indexers/all/results?apikey=XXX&Query=XXX&Category[]=XXX
   */
  private async searchJackett(provider: SearchProvider, query: string, category?: string): Promise<SearchResult[]> {
    const baseUrl = provider.url.replace(/\/$/, '');
    const params = new URLSearchParams({
      apikey: provider.apiKey || '',
      Query: query,
    });
    if (category) params.append('Category[]', category);

    const url = `${baseUrl}/api/v2.0/indexers/all/results?${params}`;
    const response = await this.fetchJSON(url);

    if (!response || !Array.isArray(response.Results)) {
      throw new Error('Unexpected Jackett response (missing Results array)');
    }

    return response.Results.map((r: any): SearchResult => ({
      title: r.Title || '',
      magnetUri: r.MagnetUri || undefined,
      torrentUrl: r.Link || undefined,
      size: r.Size || 0,
      seeds: r.Seeders || 0,
      leechers: r.Peers || 0,
      provider: provider.name,
      publishDate: r.PublishDate || undefined,
      category: r.CategoryDesc || undefined,
      infoHash: r.InfoHash || undefined,
    }));
  }

  /**
   * Torznab API — compatible with Prowlarr, NZBHydra2, etc.
   * GET /api?apikey=XXX&t=search&q=XXX&cat=XXX
   */
  private async searchTorznab(provider: SearchProvider, query: string, category?: string): Promise<SearchResult[]> {
    const baseUrl = provider.url.replace(/\/$/, '');
    const params = new URLSearchParams({
      apikey: provider.apiKey || '',
      t: 'search',
      q: query,
    });
    if (category) params.append('cat', category);

    const url = `${baseUrl}/api?${params}`;
    const xml = await this.fetchText(url);

    return this.parseTorznabXML(xml, provider.name);
  }

  private parseTorznabXML(xml: string, providerName: string): SearchResult[] {
    const results: SearchResult[] = [];

    try {
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;

      while ((match = itemRegex.exec(xml)) !== null) {
        const item = match[1];
        const title = this.extractXMLTag(item, 'title') || '';

        // Extract magnet from torznab:attr
        let magnetUri: string | undefined;
        let infoHash: string | undefined;
        let size = 0;
        let seeds = 0;
        let leechers = 0;

        const attrRegex = /<torznab:attr\s+name="([^"]+)"\s+value="([^"]+)"/gi;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(item)) !== null) {
          const [, name, value] = attrMatch;
          switch (name.toLowerCase()) {
            case 'magneturl': magnetUri = value; break;
            case 'infohash': infoHash = value; break;
            case 'seeders': seeds = parseInt(value) || 0; break;
            case 'peers': leechers = parseInt(value) || 0; break;
            case 'size': size = parseInt(value) || 0; break;
          }
        }

        // Fallback size from enclosure
        const enclosureMatch = item.match(/<enclosure[^>]*length="(\d+)"/i);
        if (enclosureMatch && !size) size = parseInt(enclosureMatch[1]) || 0;

        const torrentUrl = this.extractXMLTag(item, 'link') || undefined;
        const pubDate = this.extractXMLTag(item, 'pubDate') || undefined;

        results.push({
          title,
          magnetUri,
          torrentUrl,
          size,
          seeds,
          leechers,
          provider: providerName,
          publishDate: pubDate,
          infoHash,
        });
      }
    } catch (err) {
      log.error('Torznab XML parse error', { error: err });
    }

    return results;
  }

  /**
   * Custom provider — simple GET with {query} placeholder in URL.
   * Expects JSON response: { results: [{ title, magnetUri, size, seeds, leechers }] }
   */
  private async searchCustom(provider: SearchProvider, query: string, _category?: string): Promise<SearchResult[]> {
    const url = provider.url
      .replace('{query}', encodeURIComponent(query))
      .replace('{apikey}', provider.apiKey || '');

    const response = await this.fetchJSON(url);

    if (!response || !Array.isArray(response.results)) {
      throw new Error('Unexpected response (missing results array)');
    }

    return response.results.map((r: any): SearchResult => ({
      title: r.title || '',
      magnetUri: r.magnetUri || r.magnet || undefined,
      torrentUrl: r.torrentUrl || r.url || undefined,
      size: r.size || 0,
      seeds: r.seeds || r.seeders || 0,
      leechers: r.leechers || r.peers || 0,
      provider: provider.name,
      publishDate: r.publishDate || r.date || undefined,
      category: r.category || undefined,
      infoHash: r.infoHash || r.hash || undefined,
    }));
  }

  private extractXMLTag(xml: string, tag: string): string | null {
    const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
    const cdataMatch = xml.match(cdataRegex);
    // CDATA content is literal — don't entity-decode it.
    if (cdataMatch) return cdataMatch[1].trim();

    const normalRegex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
    const normalMatch = xml.match(normalRegex);
    // Regular text content is entity-encoded ("&amp;", "&#39;", …) — decode it
    // so titles and links aren't shown/queried with raw entities.
    if (normalMatch) return this.decodeEntities(normalMatch[1].trim());

    return null;
  }

  /** Decode the common XML/HTML entities found in feed titles and links. */
  private decodeEntities(s: string): string {
    return s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&amp;/g, '&'); // last, so "&amp;lt;" doesn't become "<"
  }

  private async fetchJSON(url: string): Promise<any> {
    const text = await this.fetchText(url, { 'Accept': 'application/json' });
    return JSON.parse(text);
  }

  private async fetchText(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.get(url, {
        headers: {
          'User-Agent': `TorrentHunt/${app.getVersion()} Search`,
          ...extraHeaders,
        },
        timeout: 20000,
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          this.fetchText(res.headers.location, extraHeaders).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} from search provider`));
          return;
        }
        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => resolve(data));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Search request timeout')); });
    });
  }
}

let searchService: SearchService | null = null;

export function getSearchService(): SearchService {
  if (!searchService) {
    searchService = new SearchService();
  }
  return searchService;
}
