# TorrentHunt search plugins

A **script provider** lets TorrentHunt search any source by running a small local
program you point it at. TorrentHunt ships no scrapers itself — you bring the
script. This keeps the app neutral and lets you (or the community) add indexers
without hosting a Jackett/Prowlarr server.

## How it works

When you run a search, TorrentHunt invokes your script like this:

```
<python> <your_script.py> "<query>" "<category>"
```

- `<python>` is the Python 3 interpreter TorrentHunt auto-detects on your system.
- `"<query>"` is what you typed in the search box.
- `"<category>"` is a [Newznab category id](https://newznab.readthedocs.io/en/latest/misc/api/#predefined-categories)
  (`2000` movies, `5000` TV, `3000` music, `4000` software, `6000` XXX) or an
  **empty string** when "All categories" is selected.

Your script must **print a JSON array of results to stdout** and exit. Anything on
stderr is ignored (use it for your own debug logging).

### Output format

```json
[
  {
    "title": "Some Release Name 1080p",
    "magnetUri": "magnet:?xt=urn:btih:...",
    "torrentUrl": "https://example.org/download/123.torrent",
    "infoHash": "0123456789abcdef0123456789abcdef01234567",
    "size": 1610612736,
    "seeds": 42,
    "leechers": 3,
    "publishDate": "2026-06-17",
    "category": "Movies/HD"
  }
]
```

Field rules:

| Field         | Required | Notes                                                        |
|---------------|----------|-------------------------------------------------------------|
| `title`       | **yes**  | Display name.                                                |
| `magnetUri`   | one of these three | Magnet link.                                      |
| `torrentUrl`  | one of these three | Direct `.torrent` URL.                            |
| `infoHash`    | one of these three | 40-char hex (TorrentHunt rebuilds the magnet).    |
| `size`        | no       | Bytes (integer). Defaults to 0.                             |
| `seeds`       | no       | Integer. Defaults to 0. Results are sorted by this.        |
| `leechers`    | no       | Integer. Defaults to 0.                                      |
| `publishDate` | no       | Any string.                                                 |
| `category`    | no       | Free-text label shown in the results table.                 |

A row with no `title`, or with none of `magnetUri` / `torrentUrl` / `infoHash`,
is dropped.

A `{ "results": [ ... ] }` wrapper object is also accepted, so the same script can
serve both this provider and the "Custom JSON" HTTP provider.

## Credentials (for indexers that need a login)

Some indexers (e.g. RuTracker) require an account. Put the login in the provider's
**Login** / **Password** fields in TorrentHunt instead of hard-coding it in the
script — the password is stored **encrypted** by the OS keychain (DPAPI / Keychain
/ libsecret), never in plaintext. TorrentHunt passes them to the script as
environment variables:

| Env var           | From the provider field |
|-------------------|-------------------------|
| `TH_USERNAME`     | Login                   |
| `TH_PASSWORD`     | Password                |
| `TH_APIKEY`       | API Key                 |
| `TH_PROVIDER_URL` | URL                     |

Read them with `os.environ.get("TH_USERNAME")` etc.

## Limits & safety

- The script runs **on your machine with your permissions** — only add scripts you
  trust and have read.
- It must finish within **25 seconds** and print at most **8 MB** / **500 results**.
- It is launched with `execFile` (no shell), so the query is never interpreted by a
  shell — no injection risk from what you type.
- Only `.py` files are accepted.

## Files here

- [`example_indexer.py`](example_indexer.py) — a minimal, runnable template.
- [`qbittorrent_adapter.py`](qbittorrent_adapter.py) — run your existing
  **qBittorrent search plugins** through this provider (see its header).
- [`rutracker.py`](rutracker.py) — **RuTracker** search. Add a Python Script
  provider pointing at it and fill in your RuTracker Login/Password. Stdlib-only;
  handles the .org/.net/.nl mirrors and a `cookie:<bb_session>` captcha fallback.
  Verify the parser offline with `python rutracker.py --selftest`.
