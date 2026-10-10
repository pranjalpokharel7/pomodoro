#!/usr/bin/env python3
"""Find SomaFM stations to add to the dropdown in index.html.

  python3 tools/stations.py              # every channel not yet in the dropdown
  python3 tools/stations.py ambient chill  # only channels matching any keyword

Fetches SomaFM's channel list, checks each stream really serves audio (same URL
shape as script.js), and prints <option> lines to paste into the #station select.
"""
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

CHANNELS = "https://somafm.com/channels.json"
STREAM = "https://ice1.somafm.com/{}-128-mp3"  # keep in sync with stationUrl() in script.js
HTML = Path(__file__).resolve().parent.parent / "index.html"


def fetch(url, method="GET"):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "pomodoro-station-finder"})
    return urllib.request.urlopen(req, timeout=10)


def works(cid):
    try:
        with fetch(STREAM.format(cid), "HEAD") as r:
            return r.status == 200 and r.headers.get("Content-Type", "").startswith("audio")
    except OSError:
        return False


def main():
    words = [w.lower() for w in sys.argv[1:]]
    have = set(re.findall(r'<option value="([^"]+)"', HTML.read_text()))
    with fetch(CHANNELS) as r:
        channels = json.load(r)["channels"]

    def match(c):
        text = " ".join(str(c[k]) for k in ("id", "title", "genre", "description")).lower()
        return not words or any(w in text for w in words)

    todo = [c for c in channels if c["id"] not in have and match(c)]
    with ThreadPoolExecutor(8) as pool:
        ok = list(pool.map(lambda c: works(c["id"]), todo))

    good = [c for c, o in zip(todo, ok) if o]
    for c, o in zip(todo, ok):
        print(f'{"ok  " if o else "DEAD"} {c["id"]:<16} {c["title"]:<26} {c["genre"]:<22} {c["listeners"]} listening')
    print(f"\n{len(channels)} channels, {len(have)} already in dropdown, {len(good)} new and working.")
    if good:
        print("\nPaste into <select id=\"station\"> in index.html:\n")
        for c in good:
            genre = c["genre"].replace("|", ", ")
            print(f'        <option value="{c["id"]}">{c["title"]} · {genre}</option>')


main()
