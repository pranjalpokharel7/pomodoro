# Pomodoro

A cute, minimal static pomodoro timer. No build step, no dependencies, no framework. Open `index.html` in a browser to run it. Keep it that way: plain HTML, CSS and JS only.

## Red lines

- Never add a build step, framework or dependency: plain HTML, CSS and JS only. [Files]
- Always keep the script and stylesheet load order in `index.html`, since scripts share globals. [Files]
- Never bind the mode tabs with `[data-mode]`: `<body>` has it too and every click would reset the timer. [Gotchas]
- Never put `overflow: hidden` on `body`, the card can be taller than short screens. [Gotchas]
- CSS paths are relative to the CSS file, so the background is `../bg.jpg`. [Files]
- Keep `stationUrl()` in `scripts/radio.js` and the URL pattern in `tools/stations.py` identical. [Adding SomaFM stations]
- Never play audio before a user click: Start and Play lofi are those clicks. [Gotchas]

## Files

Code map. Scripts are plain `<script>` tags (ES modules don't load from `file://`) that share globals, so keep the load order below. Styles load in the order listed too (later files win ties, so `stylesheet/buttons.css` stays before `stylesheet/timer.css`).

- `index.html`: page structure and the script/stylesheet tags. `<body>` starts with class `locked`: only the full-screen sign-in form `#gate` (email, password, Sign in, no card) shows, and `main`, `.corner` and the quote are hidden until `profile.js` signs in. Settings (⚙️) and ✨ sit outside the card, fixed top-right, and the Sign out button (log-out icon, tooltip shows the name) is fixed bottom-right. The leaderboard `#lb` is a `<details>` (round trophy `<summary>` + `.panel`) fixed top-left, collapsible like the right-side icons. The card holds the stats row, mode tabs, timer ring, the current-task input, Start/Reset, the radio controls, and the session-history list. Element ids used by scripts: `gate`, `email`, `pw`, `signout`, `lb`, `board`, `lbtabs`, `task`, `history`, `motivate`, `quote`, `focusMin`/`shortMin`/`longMin`, `total`, `clear`, `sessions`, `ring`, `time`, `toggle`, `reset`, `skip`, `music`, `vol`, `station`.

Scripts, in load order:

- `scripts/common.js`: the `$` id helper.
- `scripts/timer.js`: state (`mode`, `remaining`, `endAt`, `timer`, `total`, `sessions`, `days`, `inputs`), `show()` (the card shows *today's* time/sessions, not all-time), `save()`, `setMode()`, `start()`/`pause()`/`stop()`, `tick()`, `finish()` (auto-chain, long break every 4th), `beep()` (chime), the time helpers `hms`/`hm`/`dayKey`/`today`/`pruneDays` (`days` is `{ "YYYY-MM-DD": { ms, n } }`, kept to 30 days, used by the leaderboard), and the handlers for Start, Skip, Clear, Reset and the mode tabs. `start()`/`stop()` call `window.sync?.()` to update the leaderboard presence dot; `finish()` calls `window.logFocus?.()` to record the session.
- `scripts/tasks.js`: the per-session task label and local history. `#task` input (saved as `pomo-task`), `taskText()` (read by `profile.js` to push the current task to the leaderboard), `logFocus(ms)` (appends to `sessionLog`, saved as `pomo-log`, capped), `clearHistory()` (called by the 🗑️ clear and sign-out), and `renderHistory()` into `#history`.
- `scripts/radio.js`: lofi radio. `stationUrl()`, `userVol`, `applyVolume()` with the `FADE_MS`/`CHIME_MS` ducking, `duckForChime()` (called by `finish()`), `PLAY`/`PAUSE` icons, `radioPlay()`/`radioStop()`, and the volume and station handlers.
- `scripts/quotes.js`: the `QUOTES` list, `QUOTE_MS`, the shuffled bag, and the ✨ and quote click handlers.
- `scripts/settings.js`: restores and saves the minutes inputs (`pomo-mins`), and closes the settings panel on outside click. The leaderboard is left alone (it only collapses via its own trophy icon).
- `scripts/profile.js`: email/password sign-in through the full-screen `#gate` form, sign-out from the bottom-right `#signout` button (stops the timer and radio, pushes the last score, then wipes this device's local totals, days, task and history so the next person here starts clean), `applyAuth()` toggling `body.locked` (a cosmetic gate: the database rules are the real lock), and the leaderboard (`#lb` details, only shown when signed in) synced every 30s with Firebase over plain `fetch`, no SDK. The board ranks by the selected range (`#lbtabs`: Today / Week / All, saved as `pomo-lbrange`); `metric()`/`streak()` derive per-range time and 🔥 streak from each record's `days` (session count is not shown on the board); `renderBoard()` keeps stable per-uid rows and animates rank changes with a FLIP transform, flashing a row whose time rose; a pulsing dot marks anyone whose `active` heartbeat is under 75s old, and their current `task` shows beneath their name. The session is kept in `localStorage` as `pomo-auth` (ID token plus refresh token, refreshed hourly; a changed password signs the device out at the next refresh) and the last email as `pomo-email`. See "Profiles and passwords" below. Sign-in takes the max of local and cloud totals and merges `days` per date, so a new device doesn't overwrite.
- `scripts/main.js`: the initial `setMode('focus')`. Must stay last.

Styles, in load order:

- `stylesheet/theme.css`: colour variables. Mode colours come from `--accent`, `--g1`, `--g2` set per `body[data-mode]`.
- `stylesheet/base.css`: page background (`bg.jpg` with a mode-coloured wash), glow blobs, the frosted-glass card.
- `stylesheet/buttons.css`: shared button styles (`.active`, `.primary`, `.icon`).
- `stylesheet/stats.css`: today's time / sessions row, and the leaderboard (trophy summary, dropdown `.panel`, range tabs, two-line entries, presence dot, rank-change flash, current-task line).
- `stylesheet/timer.css`: mode tabs, ring, time text, the current-task pill (`.task`), Start/Reset, and the session-history list (`.history`/`.hrow`).
- `stylesheet/radio.css`: play/pause, volume, station dropdown, SomaFM credit.
- `stylesheet/settings.css`: top-right ✨/⚙️ buttons and the settings panel.
- `stylesheet/quotes.css`: the quote card.

Other:

- `bg.jpg`: cozy lamp-corner photo by Claire on Unsplash (Unsplash License, no credit needed). Stored locally so it works offline.
- `tools/stations.py`: finds SomaFM stations to add to the dropdown (see below).

## Profiles and passwords

- No names, emails or passwords in the code. Users are real Firebase Auth email/password users made in the console (Authentication → Users → Add user).
- Add a person: just add the user in the console. On their first sign-in the app asks "What should we call you?" and saves it as the Firebase display name (the console can't set it), and the name is copied into their score record so the scoreboard can show it.
- Change or reset a password: Firebase console → Authentication → Users → ⋮ (or the user's own reset email). No code change, no cache delay.
- Scores live at `/scores/<uid>` as `{name, total, sessions, days, active, task}`: `total`/`sessions` are all-time (power the *All* range), `days` is `{ "YYYY-MM-DD": { ms, n } }` (per-day focus ms + session count, powers Today/Week and streaks), `active` is the last focus-heartbeat timestamp (presence), and `task` is the current focus label shown while live. The scoreboard shows every record that has a `name`.
- Database rules (Firebase console → Realtime Database → Rules). Each user can only write their own score, and only signed-in users can read. The extra fields (`days`, `active`, `task`) work without this update because RTDB allows children with no `.validate`, but the rules below add validation — paste them to harden it:

```json
{
  "rules": {
    "scores": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.child('total').isNumber() && newData.child('sessions').isNumber() && newData.child('name').isString() && newData.child('name').val().length <= 20",
        "days": { "$day": { ".validate": "newData.child('ms').isNumber() && newData.child('n').isNumber()" } },
        "active": { ".validate": "newData.isNumber()" },
        "task": { ".validate": "newData.isString() && newData.val().length <= 60" }
      }
    }
  }
}
```

## How it behaves

- Modes: focus, short break, long break. Durations are editable in the settings panel (minutes).
- Intervals auto-chain: focus → break → focus, and so on. Every 4th finished focus session gets the long break (hardcoded in `finish()`). Press Pause to stop the loop.
- The card's stats show **today** (not all-time): the "Today" time and the "Sessions" count both come from today's bucket in `days`. Focus time still accrues into the all-time `pomo-total` too (for the leaderboard's *All* range), ticking every 250ms. The 🗑️ button (with a confirm prompt) clears everything: total, sessions, all `days`, and the task + history.
- Session label + history: the `#task` pill under the ring is what you're working on (saved as `pomo-task`, synced to the leaderboard only while focusing). Each completed focus session is appended to a local history log (`pomo-log`, last 20) shown under the card; editing the label pushes it to the board.
- Leaderboard: a collapsible trophy top-left (like ⚙️/✨); it toggles only when its own icon is clicked, not on outside click. Ranks everyone by the selected range (Today / Week / All), showing medal, name, range time, 🔥 streak, a green "focusing now" dot, and the live user's current task. Rank changes animate; a row flashes when its time rises. Synced every 30s (plus immediately on Start/Pause) over plain `fetch`.
- The timer uses an absolute `endAt` timestamp, so it stays accurate when the tab is in the background.
- The chime is a three-note C-E-G arpeggio made with Web Audio (no audio file). The `AudioContext` is created in `start()` because browsers only allow sound after a click.
- Radio: SomaFM streams played through an `Audio` element at `https://ice1.somafm.com/<id>-128-mp3`. The `<option value>` in `#station` is the SomaFM channel id. Pausing the radio removes `src` on purpose, so a live stream stops downloading and resumes live.
- Music ducking: the radio fades to 15% over the last 10 seconds of every interval, goes silent while the chime plays (`CHIME_MS`), then restores. Tunables are `FADE_MS` and `CHIME_MS` next to `applyVolume()` in `scripts/radio.js`. The volume slider sets `userVol`, and the fade is a fraction of it.
- Motivational quotes: the ✨ button (top-right, next to ⚙️) shows one gentle quote from the `QUOTES` list in `scripts/quotes.js`. It is opt-in only, never automatic, so the app stays calm. The quote drops in from the top of the screen over the background (top-centre on wide screens, left of the buttons on phones), fades out after `QUOTE_MS` (7s), and click dismisses it. A shuffled bag avoids repeats until every quote has been shown. To add quotes, append strings to `QUOTES`.
- Persisted in `localStorage`: all-time total (`pomo-total`), sessions (`pomo-sessions`), per-day buckets (`pomo-days`), current task (`pomo-task`), session history (`pomo-log`), leaderboard range (`pomo-lbrange`), minutes settings (`pomo-mins`, restored and range-checked at load, bad data falls back to defaults), volume (`pomo-vol`) and station (`pomo-station`).

## Adding SomaFM stations

```
python3 tools/stations.py                # every channel not yet in the dropdown
python3 tools/stations.py ambient chill  # only channels matching a keyword
```

It reads SomaFM's `channels.json`, checks that each stream really serves audio, skips ids already in `index.html`, and prints `<option>` lines to paste into `<select id="station">`. The stream URL pattern in the tool must match `stationUrl()` in `scripts/radio.js`. Python stdlib only.

## Testing

No test suite. Verify in a real browser (Chrome DevTools MCP works well):

- Reload with cache ignored after edits, since the page is a `file://` URL.
- To test interval ends without waiting, override `Date.now` with an offset in the page, for example `Date.now = () => real() + off`, then move `off` forward. This is how the finish, auto-start and fade were tested.
- To test the clear button, set `localStorage` `pomo-total` and `pomo-sessions` first, then reload.

## Gotchas

- Mode tab handlers are bound with `querySelectorAll('.modes button')`. Do not use `[data-mode]`, because `<body>` also has `data-mode` and every click would reset the timer.
- The settings panel closes on any click outside it (a document click listener at the bottom of `scripts/settings.js`).
- `body` must not use `overflow: hidden`, because the card can be taller than short screens. Only `overflow-x` is hidden.
- The Quicksand font comes from Google Fonts and needs internet. Offline it falls back to a system font and everything else still works.
- Autoplay: the radio and chime need a user click first. Start and Play lofi are those clicks.
- Cache busting: every local stylesheet and script link in `index.html` ends in `?v=N`, so a deployed site doesn't serve stale files (GitHub Pages caches about 10 minutes). Before each deploy that changes a CSS or JS file, bump them all: `sed -i -E 's/\?v=[0-9]+/?v=3/g' index.html` (use the next number). `index.html` itself can't be versioned, so it may still lag a few minutes.

## Ideas not done yet

- Make the "long break every 4 sessions" interval a setting.
- Add a keyboard shortcut for Start/Pause.
- Review the dropdown: The Dark Zone and Doomed (dark ambient/industrial) may not suit studying.
- Optional extra: a Lofi Girl YouTube embed as another music source (embedding is allowed, needs the YouTube IFrame API).
