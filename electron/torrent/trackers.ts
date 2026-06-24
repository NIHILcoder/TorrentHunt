/**
 * Default public BitTorrent trackers for newly-created torrents.
 *
 * Kept in its own tiny module (no WebTorrent import) so the MAIN process can read
 * the list — e.g. the Create-Torrent UI's "default trackers" — without pulling in
 * creator.ts, which imports WebTorrent. (Torrent creation itself runs in the host.)
 */

// Curated, high-uptime public trackers. UDP first (cheapest), plus a few
// HTTP/HTTPS+WSS so peers are still found on networks that block UDP. Kept
// reasonably sized and de-duped. Used for created torrents AND unioned into
// MAGNET adds (never .torrent files, which may be private) to widen peer
// discovery beyond DHT/PEX.
export const DEFAULT_TRACKERS: string[][] = [
  ['udp://tracker.opentrackr.org:1337/announce'],
  ['udp://open.tracker.cl:1337/announce'],
  ['udp://open.demonii.com:1337/announce'],
  ['udp://tracker.openbittorrent.com:6969/announce'],
  ['udp://open.stealth.si:80/announce'],
  ['udp://tracker.torrent.eu.org:451/announce'],
  ['udp://exodus.desync.com:6969/announce'],
  ['udp://explodie.org:6969/announce'],
  ['udp://tracker.theoks.net:6969/announce'],
  ['udp://tracker1.bt.moack.co.kr:80/announce'],
  ['udp://opentracker.i2p.rocks:6969/announce'],
  ['udp://tracker.dler.org:6969/announce'],
  ['udp://uploads.gamecoast.net:6969/announce'],
  ['udp://tracker-udp.gbitt.info:80/announce'],
  ['https://tracker.tamersunion.org:443/announce'],
  ['https://tracker.gbitt.info:443/announce'],
  ['http://tracker.openbittorrent.com:80/announce'],
  ['wss://tracker.openwebtorrent.com'],
];

export function getDefaultTrackers(): string[][] {
  return DEFAULT_TRACKERS;
}
