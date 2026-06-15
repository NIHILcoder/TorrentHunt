/**
 * Startup splash controller.
 *
 * The splash markup + CSS live inline in index.html so they paint in the first
 * frame. Dismissal lives HERE (in the bundle) rather than an inline <script>,
 * because the production CSP is `script-src 'self'` — inline scripts are blocked,
 * which previously left the splash stuck on screen forever. A bundled module is
 * 'self', so it runs fine.
 */

let dismissed = false;
let scheduled = false;
const MIN_VISIBLE_MS = 450; // avoid a jarring flash if data loads instantly
const startedAt = Date.now();

function hideNow(): void {
  if (dismissed) return;
  dismissed = true;
  const el = document.getElementById('th-splash');
  if (!el) return;
  el.classList.add('th-splash-out');
  window.setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 520);
}

/** Fade out the splash. Idempotent; honours a minimum visible time. */
export function dismissSplash(): void {
  if (dismissed || scheduled) return;
  scheduled = true;
  window.setTimeout(hideNow, Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt)));
}

/** Safety net: force the splash down after `ms` even if the app never reports
 *  ready (e.g. a mount error), so it can never trap the user. */
export function armSplashFailsafe(ms = 6000): void {
  window.setTimeout(hideNow, ms);
}
