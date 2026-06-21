/**
 * Adaptive upload throttle — "bufferbloat protection".
 *
 * THE PROBLEM
 *   A torrent saturating your upload link is the #1 cause of "the internet
 *   suddenly dies": once the modem's upstream buffer fills, every outbound
 *   packet — including the tiny TCP ACKs that pace your *downloads* and the
 *   handshakes for web pages, calls and games — waits behind a queue of torrent
 *   data. Latency balloons from ~20 ms to seconds. Every other app stutters.
 *
 *   Mainstream clients only offer a fixed manual upload cap. The user has to
 *   know their exact link speed, leave a safety margin, and re-tune it whenever
 *   conditions change. Almost nobody does, so torrents get the blame.
 *
 * THE APPROACH
 *   Continuously measure round-trip latency across the WAN link (a cheap TCP
 *   connect-time probe to a public host). The *minimum* observed latency is the
 *   unloaded baseline. When current latency rises well above that baseline the
 *   upload queue is filling, so we back the upload cap off (multiplicative
 *   decrease). When latency is clear we creep the cap back up (additive
 *   increase). This is the same AIMD control loop TCP itself uses, applied to
 *   the whole client's upload — it converges on the highest upload rate that
 *   does NOT wreck latency for everything else. The user never touches a slider.
 *
 *   Only upload is governed: upstream bufferbloat is what kills a home line, and
 *   capping download here would just throttle the thing the user wants.
 *
 * PRIVACY
 *   Detecting WAN-side bufferbloat requires probing something across the link
 *   (the LAN gateway sits *before* the congested buffer, so it can't see it).
 *   We open a bare TCP connection to a public resolver's :443 and time the
 *   handshake — no payload is sent, no DNS lookup is made (literal IPs). It runs
 *   only while this feature is enabled, which is why it's opt-in.
 */

import net from 'net';
import { logger } from '../utils/logger';

const log = logger.child('AdaptiveThrottle');

const UNLIMITED = -1;

// Literal IPs (no DNS lookup) of well-known anycast resolvers, probed on :443
// which is always open. Rotated so we never lean on a single host.
const PROBE_TARGETS: Array<{ host: string; port: number }> = [
  { host: '1.1.1.1', port: 443 },
  { host: '8.8.8.8', port: 443 },
];

const PROBE_INTERVAL_MS = 2000;   // how often we sample latency
const PROBE_TIMEOUT_MS = 1500;    // connect attempts slower than this = "no sample"

// Congestion test: current latency is "bad" when it exceeds the baseline by both
// a multiplicative factor AND an absolute margin. The margin stops tiny baselines
// (a 5 ms unloaded RTT) from tripping on harmless few-ms jitter.
const CONGEST_RATIO = 1.8;
const CONGEST_MARGIN_MS = 60;

// AIMD response.
const DECREASE_FACTOR = 0.7;              // cut to 70% of current send rate on congestion
const INCREASE_STEP_BYTES = 25 * 1024;    // +25 KB/s per clear tick
const MIN_CAP_BYTES = 20 * 1024;          // never strangle seeding below 20 KB/s

// Don't react to congestion we aren't causing: if we're uploading less than this
// the bufferbloat is some other app's problem, so leave our cap alone.
const MIN_MEANINGFUL_UP_BYTES = 30 * 1024;

// Release the cap entirely once we've stayed clear AND well under the cap for a
// while — the torrents aren't trying to use the bandwidth, so capping is pointless.
const RELEASE_CLEAR_TICKS = 8;

// Let the baseline drift up slowly so a one-off lucky low sample can't peg it
// forever (e.g. after switching networks the real idle latency may be higher).
const BASELINE_DECAY = 1.05;

export interface AdaptiveThrottleState {
  active: boolean;
  latencyMs: number | null;
  baselineMs: number | null;
  capBytes: number;       // current upload ceiling, or -1 for unlimited
  congested: boolean;
}

export interface AdaptiveThrottleDeps {
  /** Current aggregate upload throughput in bytes/sec. */
  getUploadBps: () => number;
  /** Called whenever the adaptive upload ceiling changes (-1 = no adaptive cap). */
  onCap: (bytesPerSec: number) => void;
}

/** Time a bare TCP handshake to `host:port`; resolves ms, or null on timeout/error. */
function probeLatency(host: string, port: number, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const finish = (rtt: number | null): void => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* already gone */ }
      resolve(rtt);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(Date.now() - start));
    socket.once('timeout', () => finish(null));
    socket.once('error', () => finish(null));
    try {
      socket.connect(port, host);
    } catch {
      finish(null);
    }
  });
}

export class AdaptiveThrottle {
  private timer: NodeJS.Timeout | null = null;
  private probing = false;
  private targetIdx = 0;

  private baselineMs: number | null = null;
  private capBytes: number = UNLIMITED;
  private clearStreak = 0;
  private lastLatencyMs: number | null = null;
  private lastCongested = false;

  constructor(private readonly deps: AdaptiveThrottleDeps) {}

  isActive(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    // Reset the control loop so a re-enable starts from a clean slate.
    this.baselineMs = null;
    this.capBytes = UNLIMITED;
    this.clearStreak = 0;
    this.lastLatencyMs = null;
    this.lastCongested = false;
    this.timer = setInterval(() => { void this.tick(); }, PROBE_INTERVAL_MS);
    log.info('Adaptive upload throttle enabled');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Hand control back: clear any adaptive cap so manual limits alone apply.
    if (this.capBytes !== UNLIMITED) {
      this.capBytes = UNLIMITED;
      this.deps.onCap(UNLIMITED);
    }
    log.info('Adaptive upload throttle disabled');
  }

  getState(): AdaptiveThrottleState {
    return {
      active: this.isActive(),
      latencyMs: this.lastLatencyMs,
      baselineMs: this.baselineMs,
      capBytes: this.capBytes,
      congested: this.lastCongested,
    };
  }

  private async tick(): Promise<void> {
    if (this.probing) return; // a slow probe overran the interval — skip this beat
    this.probing = true;
    try {
      const target = PROBE_TARGETS[this.targetIdx % PROBE_TARGETS.length];
      this.targetIdx++;
      const rtt = await probeLatency(target.host, target.port, PROBE_TIMEOUT_MS);
      if (rtt === null) return; // no sample — don't act on missing data
      this.lastLatencyMs = rtt;

      // Update the unloaded baseline: take the new minimum, but let the prior
      // baseline decay upward a touch so it can track genuine latency changes.
      this.baselineMs = this.baselineMs === null
        ? rtt
        : Math.min(rtt, this.baselineMs * BASELINE_DECAY + 1);

      const congested = rtt > this.baselineMs * CONGEST_RATIO + CONGEST_MARGIN_MS;
      this.lastCongested = congested;
      const up = Math.max(0, this.deps.getUploadBps());

      const prevCap = this.capBytes;

      if (congested && up >= MIN_MEANINGFUL_UP_BYTES) {
        // Back off relative to what we're actually sending (or the current cap,
        // whichever is lower) so we settle just below the onset of bufferbloat.
        const reference = this.capBytes > 0 ? Math.min(this.capBytes, up) : up;
        this.capBytes = Math.max(MIN_CAP_BYTES, Math.floor(reference * DECREASE_FACTOR));
        this.clearStreak = 0;
        log.debug('Congestion — backing off upload', { rtt, baseline: Math.round(this.baselineMs), capKBs: Math.round(this.capBytes / 1024) });
      } else if (!congested) {
        if (this.capBytes > 0) {
          if (up < this.capBytes * 0.5) {
            // We're capping but the torrents aren't even using half of it — the
            // cap is doing nothing. Release after a sustained clear stretch.
            this.clearStreak++;
            if (this.clearStreak >= RELEASE_CLEAR_TICKS) {
              this.capBytes = UNLIMITED;
              log.debug('Sustained clear + idle upload — releasing cap');
            }
          } else {
            // Link is clear and we're using the cap: probe for more headroom.
            this.capBytes += INCREASE_STEP_BYTES;
            this.clearStreak = 0;
          }
        }
      }

      if (this.capBytes !== prevCap) {
        this.deps.onCap(this.capBytes);
      }
    } catch (e) {
      log.warn('Adaptive throttle tick failed', { error: e instanceof Error ? e.message : String(e) });
    } finally {
      this.probing = false;
    }
  }
}
