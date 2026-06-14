/**
 * HostEnv — the handful of Electron `app` values the torrent engine needs.
 *
 * The engine is being moved into a `utilityProcess`, which has NO access to the
 * Electron `app` module. So instead of calling `app.getVersion()` /
 * `app.getPath(...)` directly, the engine reads them from here. In the main
 * process these are derived from `app` lazily (the default); the host process
 * calls `setHostEnv()` with values passed in its init message before creating
 * the manager, so it never touches `app`.
 */

export interface HostEnv {
  version: string;
  isPackaged: boolean;
  tempDir: string;
  userDataDir: string;
  downloadsDir: string;
}

let env: HostEnv | null = null;

/** Host process: install the values forwarded from main (call before manager use). */
export function setHostEnv(e: HostEnv): void {
  env = e;
}

/** Read the host environment. Falls back to Electron `app` (main process only). */
export function getHostEnv(): HostEnv {
  if (!env) {
    // Lazy require so the host process (which always setHostEnv() first) never
    // pulls in the Electron `app` module, which doesn't exist there.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    env = {
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      tempDir: app.getPath('temp'),
      userDataDir: app.getPath('userData'),
      downloadsDir: app.getPath('downloads'),
    };
  }
  return env;
}
