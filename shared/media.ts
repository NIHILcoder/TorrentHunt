/**
 * Media classification helpers shared by the main process (streaming server)
 * and the renderer (player UI). Pure, dependency-free so both sides can import it.
 */

const VIDEO_EXTS = new Set([
  'mp4', 'm4v', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'ogv', 'mpg', 'mpeg', 'ts', 'm2ts', '3gp',
]);
const AUDIO_EXTS = new Set([
  'mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'oga', 'opus', 'wma', 'aiff',
]);

export type MediaKind = 'video' | 'audio' | 'other';

/** Classify a file as streamable video/audio by extension. */
export function classifyMediaKind(name: string): MediaKind {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  return 'other';
}

/** True if the file can be opened in the in-app player. */
export function isStreamable(name: string): boolean {
  return classifyMediaKind(name) !== 'other';
}
