/**
 * Python Detector
 * Locates a usable Python 3 interpreter for 'script' search providers.
 * We do NOT bundle Python — the user brings their own. This probes a small set
 * of well-known launchers, verifies each reports Python 3.x, and caches the
 * first that works. Detection is cheap and safe: execFile (no shell), a short
 * timeout, and only `--version` is ever run during probing.
 */

import { execFile } from 'child_process';
import { logger } from '../utils';
import { PythonStatus } from '../../shared/types';

const log = logger.child('PythonDetector');

export interface DetectedPython {
  /** Interpreter binary or launcher to exec (e.g. "python3", "py"). */
  command: string;
  /** Args that must precede the script path (e.g. ["-3"] for the Windows py launcher). */
  baseArgs: string[];
  /** Human-readable version string, e.g. "Python 3.12.1". */
  version: string;
}

// Candidate launchers, in priority order. On Windows the `py -3` launcher is the
// most reliable; elsewhere python3/python. Each entry is [command, ...baseArgs].
const CANDIDATES: string[][] =
  process.platform === 'win32'
    ? [['py', '-3'], ['python3'], ['python']]
    : [['python3'], ['python']];

let cached: DetectedPython | null = null;
let probed = false;

function runVersion(command: string, baseArgs: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      command,
      [...baseArgs, '--version'],
      { timeout: 4000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) return resolve(null);
        // Older Pythons print the version to stderr, newer to stdout — accept either.
        const out = `${stdout || ''}${stderr || ''}`.trim();
        const m = out.match(/Python\s+(\d+)\.(\d+)\.(\d+)/i);
        if (!m) return resolve(null);
        if (parseInt(m[1], 10) < 3) return resolve(null); // require Python 3+
        resolve(out);
      }
    );
  });
}

/**
 * Resolve a working interpreter, probing candidates once and caching the result.
 * `force` re-probes (used by the UI's "re-check" affordance after an install).
 */
export async function detectPython(force = false): Promise<DetectedPython | null> {
  if (probed && !force) return cached;

  cached = null;
  for (const [command, ...baseArgs] of CANDIDATES) {
    const version = await runVersion(command, baseArgs);
    if (version) {
      cached = { command, baseArgs, version };
      log.info('Python detected', { command, baseArgs, version });
      break;
    }
  }
  if (!cached) log.info('No Python 3 interpreter found on PATH');
  probed = true;
  return cached;
}

/** UI-facing probe — never throws, returns a serializable status. */
export async function getPythonStatus(force = false): Promise<PythonStatus> {
  const py = await detectPython(force);
  if (!py) return { found: false };
  const display = py.baseArgs.length ? `${py.command} ${py.baseArgs.join(' ')}` : py.command;
  return { found: true, path: display, version: py.version };
}
