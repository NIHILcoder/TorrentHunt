#!/usr/bin/env python3
"""
RuTracker search plugin for TorrentHunt.

RuTracker is login-gated and has no public API, so this plugin logs in with YOUR
account, searches, and returns magnet links. It uses only the Python standard
library (no `pip install` needed).

CREDENTIALS — set in TorrentHunt, NOT in this file:
    Add a provider of type "Python Script" pointing at this file, then fill in the
    Login and Password fields. TorrentHunt passes them to this script as the
    environment variables TH_USERNAME / TH_PASSWORD (your real password is stored
    encrypted by the OS keychain, never in plaintext on disk).

    Captcha fallback: if RuTracker demands a captcha on login (common from a new
    IP), log in via your browser, copy the value of the `bb_session` cookie, and
    put `cookie:<that-value>` in the Password field — the plugin will use the
    cookie directly and skip the login form.

NOTES:
    - RuTracker pages are windows-1251 encoded and often gzipped — handled here.
    - It's blocked by some ISPs; TorrentHunt's DNS-over-HTTPS option helps reach
      it, and the plugin tries the .org / .net / .nl mirrors in turn.
    - The search results page has no infohash, so the plugin fetches the top
      results' topic pages (concurrently) to extract their magnet links. Result
      count is capped to stay within TorrentHunt's 25 s / 8 MB script limits.
    - Only run plugins you trust; this one talks only to rutracker mirrors.
"""

import sys
import os
import re
import json
import gzip
import io
import http.cookiejar
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

MIRRORS = [
    "https://rutracker.org/forum",
    "https://rutracker.net/forum",
    "https://rutracker.nl/forum",
]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
MAX_RESULTS = 20          # topic pages we'll fetch for magnets (cost vs. timeout)
REQ_TIMEOUT = 12          # seconds per HTTP request
MAGNET_WORKERS = 10

MAGNET_RE = re.compile(r'href="(magnet:\?xt=urn:btih:[^"]+)"', re.IGNORECASE)


def _err(msg):
    print(f"rutracker: {msg}", file=sys.stderr)


def _build_opener():
    jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar


def _request(opener, url, data=None):
    """GET (or POST if data) a URL, returning decoded (cp1251) text."""
    headers = {
        "User-Agent": UA,
        "Accept-Encoding": "gzip",
        "Accept-Language": "ru,en;q=0.8",
    }
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data, encoding="cp1251").encode("cp1251")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers)
    with opener.open(req, timeout=REQ_TIMEOUT) as resp:
        raw = resp.read()
        if (resp.headers.get("Content-Encoding") or "").lower() == "gzip":
            raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
    return raw.decode("cp1251", "replace")


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------
def _is_login_page(html):
    return 'name="login_username"' in html and 'name="login_password"' in html


def _has_captcha(html):
    return "cap_sid" in html or "captcha" in html.lower()


def _login(opener, base, username, password):
    """Log in via the form. Returns True on success. Raises on captcha."""
    html = _request(opener, base + "/login.php", data={
        "login_username": username,
        "login_password": password,
        "login": "вход",  # the submit button's value (cp1251-encoded on send)
    })
    if _has_captcha(html) and _is_login_page(html):
        raise RuntimeError(
            "RuTracker requires a captcha. Log in via your browser, copy the "
            "'bb_session' cookie, and put cookie:<value> in the Password field."
        )
    # Success if we're no longer shown the login form.
    return not _is_login_page(html)


def _set_session_cookie(jar, base, value):
    host = urllib.parse.urlparse(base).hostname
    jar.set_cookie(http.cookiejar.Cookie(
        version=0, name="bb_session", value=value, port=None, port_specified=False,
        domain=host, domain_specified=True, domain_initial_dot=False, path="/",
        path_specified=True, secure=True, expires=None, discard=False,
        comment=None, comment_url=None, rest={},
    ))


# --------------------------------------------------------------------------
# Parsing (pure functions — exercised by --selftest)
# --------------------------------------------------------------------------
def parse_search_rows(html):
    """Extract result rows from a tracker.php results page.

    Each row yields: topic id, title, size (bytes), seeds, leechers, category.
    Tolerant of attribute order; skips anything it can't parse."""
    rows = []
    # Each result is a <tr ... id="trs-tr-NNN" ...> ... </tr> block.
    for block in re.split(r'<tr[^>]*\bid="trs-tr-', html)[1:]:
        # Title + topic id.
        m = re.search(r'data-topic_id="(\d+)"[^>]*>(.*?)</a>', block, re.DOTALL)
        if not m:
            m = re.search(r'href="tracker\.php\?[^"]*t=(\d+)"[^>]*class="[^"]*tLink[^"]*"[^>]*>(.*?)</a>', block, re.DOTALL)
        if not m:
            continue
        topic_id = m.group(1)
        title = _strip_tags(m.group(2)).strip()
        if not title:
            continue
        # Size in bytes (data-ts_text on the size cell), else humanized text.
        size = 0
        ms = re.search(r'class="[^"]*tor-size"[^>]*data-ts_text="(\d+)"', block)
        if ms:
            size = int(ms.group(1))
        else:
            mh = re.search(r'class="[^"]*tor-size"[^>]*>\s*([\d.,]+)\s*([KMGT]?B)', block)
            if mh:
                size = _human_to_bytes(mh.group(1), mh.group(2))
        seeds = _first_int(re.search(r'class="[^"]*seedmed[^"]*"[^>]*>\s*(\d+)', block))
        leech = _first_int(re.search(r'class="[^"]*leechmed[^"]*"[^>]*>\s*(\d+)', block))
        cat = ""
        mc = re.search(r'class="[^"]*f-name[^"]*"[^>]*>\s*<a[^>]*>(.*?)</a>', block, re.DOTALL)
        if mc:
            cat = _strip_tags(mc.group(1)).strip()
        rows.append({"id": topic_id, "title": title, "size": size,
                     "seeds": seeds, "leech": leech, "category": cat})
    return rows


def parse_magnet(html):
    m = MAGNET_RE.search(html)
    return m.group(1) if m else None


def _strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s)
    return (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", '"').replace("&#039;", "'").replace("&nbsp;", " "))


def _first_int(match):
    try:
        return int(match.group(1)) if match else 0
    except (ValueError, TypeError):
        return 0


_UNIT = {"B": 1, "KB": 1024, "MB": 1024 ** 2, "GB": 1024 ** 3, "TB": 1024 ** 4}


def _human_to_bytes(num, unit):
    try:
        return int(float(num.replace(",", ".")) * _UNIT.get(unit.upper(), 1))
    except ValueError:
        return 0


# --------------------------------------------------------------------------
# Main search
# --------------------------------------------------------------------------
def search(query):
    username = os.environ.get("TH_USERNAME", "").strip()
    password = os.environ.get("TH_PASSWORD", "")
    if not username and not password.startswith("cookie:"):
        raise RuntimeError("Set your RuTracker Login and Password in the provider settings.")

    last_err = None
    for base in MIRRORS:
        try:
            opener, jar = _build_opener()
            if password.startswith("cookie:"):
                _set_session_cookie(jar, base, password[len("cookie:"):].strip())
            elif not _login(opener, base, username, password):
                last_err = RuntimeError("Login failed (wrong username/password?)")
                continue

            url = base + "/tracker.php?nm=" + urllib.parse.quote(query, encoding="cp1251")
            html = _request(opener, url)
            if _is_login_page(html):
                last_err = RuntimeError("Session not accepted — login may have failed")
                continue

            rows = parse_search_rows(html)[:MAX_RESULTS]
            if not rows:
                return []  # logged in fine, just no hits

            # Fetch each topic page concurrently to pull its magnet link.
            def fetch_magnet(row):
                try:
                    page = _request(opener, base + "/viewtopic.php?t=" + row["id"])
                    return row, parse_magnet(page)
                except Exception:
                    return row, None

            results = []
            with ThreadPoolExecutor(max_workers=MAGNET_WORKERS) as pool:
                for row, magnet in pool.map(fetch_magnet, rows):
                    if not magnet:
                        continue
                    results.append({
                        "title": row["title"],
                        "magnetUri": magnet,
                        "size": row["size"],
                        "seeds": row["seeds"],
                        "leechers": row["leech"],
                        "category": row["category"] or "RuTracker",
                    })
            return results
        except RuntimeError:
            raise  # credential/captcha problems are not mirror-specific
        except Exception as exc:
            last_err = exc
            continue

    raise last_err or RuntimeError("All RuTracker mirrors failed")


def _selftest():
    """Offline parser check — no network, no credentials."""
    sample_search = '''
      <table id="tor-tbl"><tbody>
      <tr id="trs-tr-1" class="tCenter hl-tr">
        <td class="row1 f-name-col"><div class="f-name"><a class="gen f">Linux</a></div></td>
        <td class="row4 med tLeft t-title-col tt">
          <div class="t-title"><a data-topic_id="6543210" class="tLink hl-tags bold" href="viewtopic.php?t=6543210">Ubuntu 24.04 LTS amd64</a></div></td>
        <td class="row4 small nowrap tor-size" data-ts_text="1610612736"><a class="small tr-dl dl-stub">1.5&nbsp;GB&nbsp;↓</a></td>
        <td class="row4 nowrap"><b class="seedmed">42</b></td>
        <td class="row4 leechmed">7</td>
      </tr></tbody></table>'''
    sample_topic = '<a class="magnet-link" href="magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Ubuntu">M</a>'
    rows = parse_search_rows(sample_search)
    assert len(rows) == 1, rows
    r = rows[0]
    assert r["id"] == "6543210" and r["title"].startswith("Ubuntu"), r
    assert r["size"] == 1610612736, r
    assert r["seeds"] == 42 and r["leech"] == 7, r
    assert r["category"] == "Linux", r
    magnet = parse_magnet(sample_topic)
    assert magnet and magnet.startswith("magnet:?xt=urn:btih:0123456789abcdef"), magnet
    print("selftest OK:", json.dumps(rows, ensure_ascii=False))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest":
        _selftest()
        return
    query = sys.argv[1] if len(sys.argv) > 1 else ""
    # argv[2] is the category (Newznab id) — RuTracker search is global, so unused.
    try:
        rows = search(query)
    except Exception as exc:
        _err(str(exc))
        rows = []
    json.dump(rows, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
