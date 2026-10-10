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

- `index.html`: page structure and the script/stylesheet tags. `<body>` starts with class `locked`: only the full-screen sign-in form `#gate` (email, password, Sign in, no card) shows, and `main`, `.corner` and the quote are hidden until `profile.js` signs in. Settings (⚙️) and ✨ sit outside the card, fixed top-right, and the Sign out button (log-out icon, tooltip shows the name) is fixed bottom-right. The card holds the stats row, mode tabs, timer ring, Start/Reset, and the radio controls. Element ids used by scripts: `gate`, `email`, `pw`, `signout`, `board`, `motivate`, `quote`, `focusMin`/`shortMin`/`longMin`, `total`, `clear`, `sessions`, `ring`, `time`, `toggle`, `reset`, `skip`, `music`, `vol`, `station`.

Scripts, in load order:

- `scripts/common.js`: the `$` id helper.
- `scripts/timer.js`: state (`mode`, `remaining`, `endAt`, `timer`, `total`, `sessions`, `inputs`), `show()`, `save()`, `setMode()`, `start()`/`pause()`/`stop()`, `tick()`, `finish()` (auto-chain, long break every 4th), `beep()` (chime), and the handlers for Start, Skip, Clear, Reset and the mode tabs.
- `scripts/radio.js`: lofi radio. `stationUrl()`, `userVol`, `applyVolume()` with the `FADE_MS`/`CHIME_MS` ducking, `duckForChime()` (called by `finish()`), `PLAY`/`PAUSE` icons, `radioPlay()`/`radioStop()`, and the volume and station handlers.
- `scripts/quotes.js`: the `QUOTES` list, `QUOTE_MS`, the shuffled bag, and the ✨ and quote click handlers.
- `scripts/settings.js`: restores and saves the minutes inputs (`pomo-mins`), and closes the settings panel on outside click.
- `scripts/profile.js`: email/password sign-in through the full-screen `#gate` form, sign-out from the bottom-right `#signout` button (stops the timer and radio, pushes the last score, then wipes this device's local totals so the next person here starts clean), `applyAuth()` toggling `body.locked` (a cosmetic gate: the database rules are the real lock), and a scoreboard (`#board`, only shown when signed in) synced every 30s with Firebase over plain `fetch`, no SDK. The session is kept in `localStorage` as `pomo-auth` (ID token plus refresh token, refreshed hourly; a changed password signs the device out at the next refresh) and the last email as `pomo-email`. See "Profiles and passwords" below. Sign-in takes the max of local and cloud totals so a new device doesn't overwrite.
- `scripts/main.js`: the initial `setMode('focus')`. Must stay last.

Styles, in load order:

- `stylesheet/theme.css`: colour variables. Mode colours come from `--accent`, `--g1`, `--g2` set per `body[data-mode]`.
- `stylesheet/base.css`: page background (`bg.jpg` with a mode-coloured wash), glow blobs, the frosted-glass card.
- `stylesheet/buttons.css`: shared button styles (`.active`, `.primary`, `.icon`).
- `stylesheet/stats.css`: total studied and sessions row.
- `stylesheet/timer.css`: mode tabs, ring, time text, Start/Reset.
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
- Scores live at `/scores/<uid>` as `{name, total, sessions}`. The scoreboard shows every record that has a `name`.
- Database rules (Firebase console → Realtime Database → Rules). Each user can only write their own score, and only signed-in users can read:

```json
{
  "rules": {
    "scores": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.child('total').isNumber() && newData.child('sessions').isNumber() && newData.child('name').isString() && newData.child('name').val().length <= 20"
      }
    }
  }
}
```

## How it behaves

- Modes: focus, short break, long break. Durations are editable in the settings panel (minutes).
- Intervals auto-chain: focus → break → focus, and so on. Every 4th finished focus session gets the long break (hardcoded in `finish()`). Press Pause to stop the loop.
- "Total studied" only counts focus time, ticks every 250ms, and is stored in `localStorage` as `pomo-total` (milliseconds). The 🗑️ button (with a confirm prompt) clears both the total and the sessions count (`pomo-sessions`).
- The timer uses an absolute `endAt` timestamp, so it stays accurate when the tab is in the background.
- The chime is a three-note C-E-G arpeggio made with Web Audio (no audio file). The `AudioContext` is created in `start()` because browsers only allow sound after a click.
- Radio: SomaFM streams played through an `Audio` element at `https://ice1.somafm.com/<id>-128-mp3`. The `<option value>` in `#station` is the SomaFM channel id. Pausing the radio removes `src` on purpose, so a live stream stops downloading and resumes live.
- Music ducking: the radio fades to 15% over the last 10 seconds of every interval, goes silent while the chime plays (`CHIME_MS`), then restores. Tunables are `FADE_MS` and `CHIME_MS` next to `applyVolume()` in `scripts/radio.js`. The volume slider sets `userVol`, and the fade is a fraction of it.
- Motivational quotes: the ✨ button (top-right, next to ⚙️) shows one gentle quote from the `QUOTES` list in `scripts/quotes.js`. It is opt-in only, never automatic, so the app stays calm. The quote drops in from the top of the screen over the background (top-centre on wide screens, left of the buttons on phones), fades out after `QUOTE_MS` (7s), and click dismisses it. A shuffled bag avoids repeats until every quote has been shown. To add quotes, append strings to `QUOTES`.
- Persisted in `localStorage`: total (`pomo-total`), sessions (`pomo-sessions`), minutes settings (`pomo-mins`, restored and range-checked at load, bad data falls back to defaults), volume (`pomo-vol`) and station (`pomo-station`).

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

## Ideas not done yet

- Make the "long break every 4 sessions" interval a setting.
- Add a keyboard shortcut for Start/Pause.
- Review the dropdown: The Dark Zone and Doomed (dark ambient/industrial) may not suit studying.
- Optional extra: a Lofi Girl YouTube embed as another music source (embedding is allowed, needs the YouTube IFrame API).
