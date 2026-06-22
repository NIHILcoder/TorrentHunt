/**
 * Multi-instance support for LOCAL TESTING of peer-to-peer features (rooms,
 * share links) on a single machine.
 *
 * TorrentHunt is normally single-instance: one profile, one tray, one identity.
 * That makes the friend-swarm rooms impossible to verify without a second
 * machine. Set the env var `TH_INSTANCE=<name>` to launch an isolated second
 * copy that:
 *   - uses its own userData dir (separate DB / config / room identity), so the
 *     two copies are genuinely different "people" in a room;
 *   - skips the single-instance lock, so it doesn't just focus the first window.
 *
 * Two such copies can then join the same room over WebRTC and you can watch the
 * whole flow (join, member presence, file transfer, kick/rekey, E2E) end-to-end.
 *
 * IMPORTANT: this file MUST be imported before electron-store and the logger,
 * because they read `app.getPath('userData')` at module-load time. That's why it
 * is the very first import in main.ts. Changing the path afterwards would be too
 * late — the stores would already point at the primary profile.
 */
import { app } from 'electron';

/** Non-empty when this process was launched as an isolated test instance. */
export const INSTANCE_ID = (process.env.TH_INSTANCE || '').trim();
export const isSecondaryInstance = INSTANCE_ID.length > 0;

if (isSecondaryInstance) {
  // Derive the isolated profile dir from the default one, e.g.
  //   …/torrenthunt  ->  …/torrenthunt-peer2
  const base = app.getPath('userData');
  app.setPath('userData', `${base}-${INSTANCE_ID}`);
  // Distinct name so the tray tooltip / OS notifications make the two copies
  // distinguishable while testing.
  app.setName(`TorrentHunt (${INSTANCE_ID})`);
}
