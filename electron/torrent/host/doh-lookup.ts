/**
 * DNS-over-HTTPS lookup for the torrent engine.
 *
 * Installs a replacement for `dns.lookup` in the torrent-host process. Node's
 * `net.connect` reads `dns.lookup` live at connect time (verified), so patching
 * it routes EVERY outbound hostname the engine touches — tracker announces, peer
 * connections, web seeds — through an encrypted DoH resolver instead of the
 * OS/router DNS. That:
 *   • survives a broken or overloaded router resolver (the built-in presets use
 *     literal-IP endpoints, so reaching them needs no DNS at all);
 *   • hides which trackers you contact from the ISP (the queries are encrypted).
 *
 * It's a thin, well-guarded layer: literal IPs and local names bypass DoH, every
 * DoH failure falls back to the original system lookup, and answers are cached by
 * their TTL. Disabled → the patch is a transparent passthrough.
 */

import dns from 'dns';
import net from 'net';
import https from 'https';
import { logger } from '../../utils/logger';

const log = logger.child('DoH');

type LookupCb = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;
interface LookupAddress { address: string; family: number; }

// Bind the real lookup once, before we overwrite it.
const origLookup = dns.lookup.bind(dns) as typeof dns.lookup;

const CACHE_MIN_TTL = 30;     // seconds
const CACHE_MAX_TTL = 3600;
const DOH_TIMEOUT_MS = 5000;

let enabled = false;
let resolverUrl = '';
let installed = false;
const cache = new Map<string, { entries: LookupAddress[]; expires: number }>();

/** Enable/disable DoH and point it at a resolver URL ('' or disabled = passthrough). */
export function configureDoh(cfg: { enabled: boolean; url: string }): void {
  const nextUrl = cfg.url || '';
  if (nextUrl !== resolverUrl) cache.clear();
  resolverUrl = nextUrl;
  enabled = !!cfg.enabled && !!resolverUrl;
  log.info('DoH configured', { enabled, resolver: enabled ? safeHost(resolverUrl) : 'off' });
}

/** Replace dns.lookup with the DoH-aware version (idempotent). */
export function installDohLookup(): void {
  if (installed) return;
  installed = true;
  (dns as unknown as { lookup: typeof patchedLookup }).lookup = patchedLookup;
}

function safeHost(u: string): string {
  try { return new URL(u).host; } catch { return '?'; }
}

function isLocalName(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h.endsWith('.local') || h.endsWith('.localhost');
}

function patchedLookup(hostname: string, options: unknown, callback?: LookupCb): void {
  let opts: { family?: number; all?: boolean } = {};
  let cb: LookupCb;
  if (typeof options === 'function') { cb = options as LookupCb; }
  else { opts = (options as typeof opts) || {}; cb = callback as LookupCb; }

  // Bypass DoH for the cases where it can't help or would loop.
  if (!enabled || !hostname || net.isIP(hostname) || isLocalName(hostname)) {
    return origLookup(hostname, options as never, cb as never);
  }

  const family = opts.family || 0;
  resolveViaDoh(hostname, family)
    .then((entries) => {
      if (!entries.length) return origLookup(hostname, options as never, cb as never);
      if (opts.all) return cb(null, entries);
      cb(null, entries[0].address, entries[0].family);
    })
    .catch(() => origLookup(hostname, options as never, cb as never));
}

async function resolveViaDoh(hostname: string, family: number): Promise<LookupAddress[]> {
  const key = `${hostname.toLowerCase()}|${family}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.entries;

  const types: Array<'A' | 'AAAA'> = family === 6 ? ['AAAA'] : family === 4 ? ['A'] : ['A', 'AAAA'];
  let entries: LookupAddress[] = [];
  let ttl = CACHE_MAX_TTL;
  for (const type of types) {
    try {
      const res = await dohQuery(hostname, type);
      entries = entries.concat(res.entries);
      if (res.ttl > 0) ttl = Math.min(ttl, res.ttl);
    } catch { /* try the next type; fall back below if all fail */ }
  }
  if (entries.length) {
    const clamped = Math.max(CACHE_MIN_TTL, Math.min(CACHE_MAX_TTL, ttl));
    cache.set(key, { entries, expires: Date.now() + clamped * 1000 });
  }
  return entries;
}

function dohQuery(hostname: string, type: 'A' | 'AAAA'): Promise<{ entries: LookupAddress[]; ttl: number }> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try { url = new URL(resolverUrl); } catch { return reject(new Error('bad DoH url')); }
    url.searchParams.set('name', hostname);
    url.searchParams.set('type', type);

    const req = https.get(url.toString(), {
      headers: { accept: 'application/dns-json' },
      // Resolve the DoH endpoint itself via the SYSTEM lookup so we never recurse
      // into ourselves. Literal-IP endpoints (the presets) make this a no-op.
      lookup: origLookup as never,
      timeout: DOH_TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('DoH HTTP ' + res.statusCode)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; if (data.length > 64 * 1024) req.destroy(new Error('DoH response too large')); });
      res.on('end', () => {
        try {
          const j = JSON.parse(data) as { Answer?: Array<{ type: number; data: string; TTL?: number }> };
          const wantType = type === 'AAAA' ? 28 : 1; // DNS RR type numbers
          const fam = type === 'AAAA' ? 6 : 4;
          const answers = Array.isArray(j.Answer) ? j.Answer : [];
          const entries: LookupAddress[] = answers
            .filter((a) => a.type === wantType && typeof a.data === 'string' && net.isIP(a.data))
            .map((a) => ({ address: a.data, family: fam }));
          const ttl = answers.reduce((m, a) => Math.min(m, a.TTL || CACHE_MIN_TTL), CACHE_MAX_TTL);
          resolve({ entries, ttl });
        } catch (e) { reject(e instanceof Error ? e : new Error(String(e))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('DoH timeout')));
  });
}
