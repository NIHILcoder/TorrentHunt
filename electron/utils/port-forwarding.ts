/**
 * Port forwarding (UPnP IGD)
 *
 * WebTorrent (µTP disabled) accepts incoming peers over a single TCP port. If
 * the router doesn't forward that port, the client can only make *outgoing*
 * connections — which throttles peer count and speed, especially for torrents
 * with few seeds. This service asks the router (via UPnP) to forward the
 * listening port back to this machine and keeps the lease renewed.
 *
 * Design notes:
 *  - UPnP IGD covers the large majority of consumer routers. NAT-PMP/PCP is a
 *    niche addition; the service interface is protocol-agnostic so it can be
 *    layered in later without touching callers.
 *  - A fixed listening port (Settings → Advanced) is required for a *stable*
 *    mapping across restarts — a random OS port can still be mapped for the
 *    session but won't persist, so we surface that in the status.
 *  - Everything is best-effort and fully guarded: a router with UPnP disabled
 *    must never break startup. Failure is reported as status, not thrown.
 */

import { Client } from '@runonflux/nat-upnp';
import { logger } from './logger';
import * as db from '../db/store';

const log = logger.child('PortForward');

export type PortForwardState =
  | 'disabled'     // turned off in settings
  | 'mapping'      // attempt in progress
  | 'mapped'       // router is forwarding the port
  | 'unsupported'  // no UPnP-capable gateway found
  | 'failed';      // gateway found but the mapping was refused / errored

export interface PortForwardStatus {
  state: PortForwardState;
  port: number | null;
  method: 'upnp' | null;
  externalIp?: string;
  error?: string;
  updatedAt: number;
}

const LEASE_TTL_SECONDS = 3600;          // ask the router for a 1-hour lease
const RENEW_INTERVAL_MS = 30 * 60 * 1000; // renew every 30 min (well before expiry)
const REQUEST_TIMEOUT_MS = 4000;          // SSDP/SOAP timeout — keep startup snappy
const DESCRIPTION = 'TorrentHunt';

class PortForwardingService {
  private client: Client | null = null;
  private port: number | null = null;
  private renewTimer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private status: PortForwardStatus = { state: 'disabled', port: null, method: null, updatedAt: Date.now() };

  getStatus(): PortForwardStatus {
    return this.status;
  }

  /**
   * Begin (or restart) forwarding `port`. Safe to call repeatedly; if the same
   * port is already mapped it's a no-op. Always tears down a prior mapping first.
   */
  async start(port: number): Promise<void> {
    if (!port || port <= 0) {
      this.setStatus({ state: 'failed', port: null, method: null, error: 'No fixed listening port to forward' });
      return;
    }
    if (this.client && this.port === port && this.status.state === 'mapped') return;

    await this.stop();
    this.port = port;
    this.client = new Client({ timeout: REQUEST_TIMEOUT_MS });

    await this.mapOnce();
    // Keep the lease alive and recover from transient router hiccups.
    this.renewTimer = setInterval(() => { void this.mapOnce(); }, RENEW_INTERVAL_MS);
  }

  /** Remove the mapping, stop renewing, and release the UPnP client. */
  async stop(): Promise<void> {
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }
    if (this.client && this.port) {
      try {
        await this.client.removeMapping({ public: this.port, protocol: 'tcp' });
        log.info('Removed UPnP port mapping', { port: this.port });
      } catch {
        /* router may have already dropped it — ignore */
      }
    }
    if (this.client) {
      try { this.client.close(); } catch { /* ignore */ }
      this.client = null;
    }
    this.port = null;
    this.setStatus({ state: 'disabled', port: null, method: null });
  }

  private async mapOnce(): Promise<void> {
    if (!this.client || !this.port || this.inFlight) return;
    this.inFlight = true;
    const client = this.client;
    const port = this.port;
    try {
      // Probe for an IGD first so "router has no UPnP" reads as a clean,
      // non-alarming state rather than a generic failure.
      try {
        await client.getGateway();
      } catch {
        this.setStatus({ state: 'unsupported', port, method: null, error: 'No UPnP-capable router found' });
        return;
      }

      this.setStatus({ state: 'mapping', port, method: 'upnp' });
      await client.createMapping({
        public: port,
        private: port,
        protocol: 'tcp',
        ttl: LEASE_TTL_SECONDS,
        description: DESCRIPTION,
      });

      let externalIp: string | undefined;
      try { externalIp = await client.getPublicIp(); } catch { /* optional enrichment */ }

      this.setStatus({ state: 'mapped', port, method: 'upnp', externalIp });
      log.info('Port forwarded via UPnP', { port, externalIp });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this.setStatus({ state: 'failed', port, method: 'upnp', error });
      log.warn('UPnP port mapping failed', { port, error });
    } finally {
      this.inFlight = false;
    }
  }

  private setStatus(partial: Omit<Partial<PortForwardStatus>, 'updatedAt'> & { state: PortForwardState }): void {
    this.status = { ...this.status, ...partial, updatedAt: Date.now() };
  }
}

let service: PortForwardingService | null = null;

export function getPortForwarding(): PortForwardingService {
  if (!service) service = new PortForwardingService();
  return service;
}

/**
 * (Re)start or stop forwarding based on the persisted setting and the torrent
 * client's current listening port. Called on startup and whenever the relevant
 * settings change. `getPort` resolves the live listening port lazily.
 */
export async function restartPortForwardingFromConfig(getPort: () => number): Promise<void> {
  const svc = getPortForwarding();
  let enabled = true;
  try {
    const settings = await db.getSettings();
    enabled = settings.portForwarding !== false; // default on
  } catch {
    enabled = true;
  }

  if (!enabled) {
    log.info('Port forwarding disabled');
    await svc.stop();
    return;
  }

  const port = getPort();
  await svc.start(port);
}

export async function stopPortForwarding(): Promise<void> {
  if (service) await service.stop();
}
