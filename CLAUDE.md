# Pomodoro

A cute, minimal static pomodoro timer. No build step, no dependencies, no framework. Open `index.html` in a browser to run it. Keep it that way: plain HTML, CSS and JS only.

## Red lines

- Never add a build step, framework or dependency: plain HTML, CSS and JS only. [Files]
- Always keep the script and stylesheet load order in `index.html`, since scripts share globals. [Files]
- Never bind the mode tabs with `[data-mode]`: `<body>` has it too and every click would reset the timer. [Gotchas]
- Never put `overflow: hidden` on `body`, the card can be taller than short screens. [Gotchas]
- CSS paths are relative to the CSS file, so the background is `../static/bg.jpg`. [Files]
- Never play audio before a user click: Start and Play music are those clicks. [Gotchas]

## Files

Code map. Scripts are plain `<script>` tags (ES modules don't load from `file://`) that share globals, so keep the load order below. Styles load in the order listed too (later files win ties, so `stylesheet/buttons.css` stays before `stylesheet/timer.css`).

- `index.html`: page structure and the script/stylesheet tags. `<body>` starts with class `locked`: only the full-screen sign-in form `#gate` (email, password, Sign in, no card) shows, and `main`, `.corner` and the quote are hidden until `profile.js` signs in. Settings (⚙️) and ✨ sit outside the card, fixed top-right, and the Sign out button (log-out icon, tooltip shows the name) is fixed bottom-right. The leaderboard `#lb` is a `<details>` (round trophy `<summary>` + `.panel`) fixed top-left, collapsible like the right-side icons. The stats panel `#stats` is a matching `<details>` (round 📊 bar-chart `<summary>` + `.panel`) fixed bottom-left, opening upward. Beside it, `#histcard` (🕘 clock `<summary>`, class `stats-card hist`) holds the recent-sessions list `#history`, own sessions only. The card holds the stats row, mode tabs, timer ring, the current-task tag picker (a `<select>`, not a text input), Start/Reset, the radio controls, and no history list (it moved to `#histcard`). Element ids used by scripts: `yt`, `gate`, `email`, `pw`, `signout`, `lb`, `board`, `lbtabs`, `stats`, `statstabs`, `daily`, `bytask`, `histcard`, `task`, `history`, `motivate`, `quote`, `focusMin`/`shortMin`/`longMin`, `total`, `sessions`, `ring`, `time`, `toggle`, `reset`, `skip`, `music`, `vol`, `station`, `ytadd`, `ytdel`, `ytdlg`, `ytform`, `ytlink`, `ytname`, `yterr`.

Scripts, in load order:

- `scripts/common.js`: the `$` id helper.
- `scripts/timer.js`: state (`mode`, `remaining`, `endAt`, `timer`, `total`, `sessions`, `days`, `inputs`), `show()` (the card shows *today's* time/sessions, not all-time), `save()`, `setMode()`, `start()`/`pause()`/`stop()`, `tick()`, `finish()` (auto-chain, long break every 4th), `beep()` (chime), the time helpers `hms`/`hm`/`dayKey`/`today`/`pruneDays` (`days` is `{ "YYYY-MM-DD": { ms, n } }`, kept to 30 days, used by the leaderboard), and the handlers for Start, Skip, Clear, Reset and the mode tabs. `start()`/`stop()` call `window.sync?.()` to update the leaderboard presence dot; `finish()` calls `window.logFocus?.()` to record the session.
- `scripts/tasks.js`: the per-session task tag and local history. `#task` is a `<select>` tag picker, not a text field: `renderTags(sel)` (exposed as `window.renderTags`) rebuilds its options from `tags` ∪ `taskTotals` keys plus a blank "no tag" option and a "➕ New tag…" option (sentinel `NEW_TAG`); its `onchange` either records the picked tag (saved as `pomo-task`, then `window.sync?.()`) or, on "➕ New tag…", `prompt`s for a name, appends it to `tags` (saved as `pomo-tags`) and selects it. `taskText()` (read by `profile.js` to push the current tag to the leaderboard). `logFocus(ms)` appends to `sessionLog` (saved as `pomo-log`, capped) and adds to `taskTotals` (`{ "<label>": { ms, n } }`, saved as `pomo-tasks`, uncapped, powers the per-task chart, synced to the cloud by `profile.js`). `saveTasks()`/`saveTags()`. `clearHistory()` (called by sign-out) also wipes `pomo-tasks` and `pomo-tags`. `logFocus`/`clearHistory` call `renderTags()` and `window.renderStats?.()` to refresh the picker and chart. `pomo-tags` only needs to hold freshly created, not-yet-used tags; once a tag is used it survives via `taskTotals`.
- `scripts/radio.js`: YouTube music. Saved links (`ytLinks`, `pomo-yt`) are rendered into `#station` by `renderYt()` as values `yt:list:<id>` / `yt:video:<id>` (plus a "🎵 No music yet" placeholder when empty). No native prompt/alert/confirm: the ➕ button `#ytadd` (or Play with nothing saved) opens the popup `#ytdlg` (a styled `<dialog>` after `</main>`, form `#ytform`: link `#ytlink` + required name `#ytname`, errors in `#yterr`, checked by `parseYouTube()`); the 🗑 button `#ytdel` removes the selected link on a second click within 3s (first click arms it, `disarmDel()` resets). The YouTube IFrame API is loaded lazily by `loadYt()` on the first play into a hidden 1×1 `#yt` player. `playing` flag, `userVol`, `applyVolume()` (`yt.setVolume`) with the `FADE_MS`/`CHIME_MS` ducking, `duckForChime()` (called by `finish()`), `PLAY`/`PAUSE` icons, `radioPlay()`/`radioStop()`, and the volume and station handlers.
- `scripts/quotes.js`: the `QUOTES` list, `QUOTE_MS`, the shuffled bag, and the ✨ and quote click handlers.
- `scripts/settings.js`: restores and saves the minutes inputs (`pomo-mins`), and closes the settings panel on outside click. The leaderboard is left alone (it only collapses via its own trophy icon).
- `scripts/profile.js`: email/password sign-in through the full-screen `#gate` form, sign-out from the bottom-right `#signout` button (stops the timer and radio, pushes the last score, then wipes this device's local totals, days, task and history so the next person here starts clean), `applyAuth()` toggling `body.locked` (a cosmetic gate: the database rules are the real lock), and the leaderboard (`#lb` details, only shown when signed in) synced every 30s with Firebase over plain `fetch`, no SDK. The board ranks by the selected range (`#lbtabs`: Today / Week / All, saved as `pomo-lbrange`); `metric()`/`streak()` derive per-range time and 🔥 streak from each record's `days` (session count is not shown on the board); `renderBoard()` keeps stable per-uid rows and animates rank changes with a FLIP transform, flashing a row whose time rose; a pulsing dot marks anyone whose `active` heartbeat is under 75s old, and their current `task` shows beneath their name. The session is kept in `localStorage` as `pomo-auth` (ID token plus refresh token, refreshed hourly; a changed password signs the device out at the next refresh) and the last email as `pomo-email`. See "Profiles and passwords" below. Every `sync()` (sign-in included) first pulls the cloud record and takes the max of local and cloud totals, merging `days` per date, `tasks` per label and the session `log` by timestamp (`mergeCloud()`), so two signed-in devices (say the deployed site and a local `file://` copy) don't overwrite each other. `sync()` also pushes the per-task totals as a `tasks` array (RTDB keys can't hold free-text labels), and sign-in calls `window.renderStats?.()` after merging.
- `scripts/stats.js`: the stats panel's two bar charts, drawn with plain divs (no chart library). `renderDaily()` draws focus time per day from `days` over a 7 or 30 day range (`statsRange`, saved as `pomo-statsrange`, switched by the `#statstabs` tabs); `renderTasks()` draws time per task from `taskTotals`, showing the top few and grouping the rest into "Other". `renderStats()` (exposed as `window.renderStats`) redraws both; it runs on panel open, on `logFocus` (tasks.js), and after a cloud sync/sign-in (profile.js). Loads after `profile.js`.
- Hours chart (`renderHours()` in `scripts/stats.js`): 24 bars for one day (native date picker `#hoursday`), each out of 60 minutes, cut from `segments`. `tick()` in `scripts/timer.js` grows the open segment every tick (`pomo-segments`), so a crash loses at most a tick; `mergeCloud()` unions segments by start.
- `scripts/dropdown.js`: themed dropdown over any `<select class="themed">` (native popups can't be styled). The select stays the hidden source of truth; picking sets its value and fires `change`. After changing a themed select's options or value from code, call `syncDropdown(sel)` (`stats.js` does this for `#stats-user`). Loads before `stats.js`.
- `scripts/calendar.js`: the custom date picker for the Hours chart (`#hoursday` is a button whose `.value` is `YYYY-MM-DD`, `#cal` is the popup, opens upward). Loads after `stats.js` because it calls `renderHours()`; the popup is a `<span>`, not a `<div>`, since it lives inside a `<p>` and a div would be ejected by the HTML parser.
- `scripts/main.js`: the initial `setMode('focus')`. Must stay last.

Styles, in load order:

- `stylesheet/theme.css`: colour variables. Mode colours come from `--accent`, `--g1`, `--g2` set per `body[data-mode]`.
- `stylesheet/base.css`: page background (`bg.jpg` with a mode-coloured wash), glow blobs, the frosted-glass card.
- `stylesheet/buttons.css`: shared button styles (`.active`, `.primary`, `.icon`).
- `stylesheet/stats.css`: today's time / sessions row, and the leaderboard (trophy summary, dropdown `.panel`, range tabs, two-line entries, presence dot, rank-change flash, current-task line).
- `stylesheet/charts.css`: the bottom-left stats panel (📊 summary, upward `.panel`), the daily vertical-bar chart (`.daily`), and the per-task horizontal-bar chart (`.bytask`). Loaded after `stats.css`.
- `stylesheet/timer.css`: mode tabs, ring, time text, the current-task pill (`.task`), Start/Reset, and the session-history list (`.history`/`.hrow`).
- `stylesheet/radio.css`: play/pause, volume, music dropdown, YouTube credit, hidden `#yt` player.
- `stylesheet/settings.css`: top-right ✨/⚙️ buttons and the settings panel.
- `stylesheet/calendar.css`: the date picker popup. Loaded after `charts.css`.
- `stylesheet/dropdown.css`: the themed dropdown. Loaded after `calendar.css`.
- `stylesheet/quotes.css`: the quote card.

Other:

- `static/bg.jpg` (and the other theme `bg-*.jpg`): cozy lamp-corner photo by Claire on Unsplash (Unsplash License, no credit needed). Stored locally so it works offline.

## Profiles and passwords

- No names, emails or passwords in the code. Users are real Firebase Auth email/password users made in the console (Authentication → Users → Add user).
- Add a person: just add the user in the console. On their first sign-in the app asks "What should we call you?" and saves it as the Firebase display name (the console can't set it), and the name is copied into their score record so the scoreboard can show it.
- Change or reset a password: Firebase console → Authentication → Users → ⋮ (or the user's own reset email). No code change, no cache delay.
- Scores live at `/scores/<uid>` as `{name, total, sessions, days, tasks, segments, log, active, task}`: `total`/`sessions` are all-time (power the *All* range), `days` is `{ "YYYY-MM-DD": { ms, n } }` (per-day focus ms + session count, powers Today/Week and streaks), `tasks` is an array of `{ label, ms, n }` (per-task focus totals for the owner's stats chart, stored as an array since RTDB keys can't hold free-text labels; readable by all signed-in users but not shown on the board), `segments` is an array of `{ s, e }` focus runs (start and end in ms, last 30 days, merged by `s`, powers the Hours chart), `log` is the last 20 finished sessions as `{ label, ms, at }` (session history, merged by `at` across devices), `active` is the last focus-heartbeat timestamp (presence), and `task` is the current focus label shown while live. The scoreboard shows every record that has a `name`.
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
        "tasks": { "$i": { ".validate": "newData.child('label').isString() && newData.child('label').val().length <= 60 && newData.child('ms').isNumber() && newData.child('n').isNumber()" } },
        "segments": { "$i": { ".validate": "newData.child('s').isNumber() && newData.child('e').isNumber()" } },
        "log": { "$i": { ".validate": "newData.child('label').isString() && newData.child('label').val().length <= 60 && newData.child('ms').isNumber() && newData.child('at').isNumber()" } },
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
- The card's stats show **today** (not all-time): the "Today" time and the "Sessions" count both come from today's bucket in `days`. Focus time still accrues into the all-time `pomo-total` too (for the leaderboard's *All* range), ticking every 250ms. There is deliberately no clear-all button; local stats only reset on sign-out.
- Session tag + history: the `#task` dropdown under the ring is what you're working on, chosen from your tags instead of retyping (saved as `pomo-task`, synced to the leaderboard only while focusing). Pick "➕ New tag…" to create one. The tag list is derived from tags you've created (`pomo-tags`) plus any label already in your per-task totals, so tags from a synced device appear too; there is no delete (the list just grows). Each completed focus session is appended to a local history log (`pomo-log`, last 20) shown under the card; changing the tag pushes it to the board.
- Leaderboard: a collapsible trophy top-left (like ⚙️/✨); it toggles only when its own icon is clicked, not on outside click. Ranks everyone by the selected range (Today / Week / All), showing medal, name, range time, 🔥 streak, a green "focusing now" dot, and the live user's current task. Rank changes animate; a row flashes when its time rises. Synced every 30s (plus immediately on Start/Pause) over plain `fetch`.
- Stats: a collapsible 📊 bottom-left (like the leaderboard trophy), opening upward and toggling only on its own icon. Two plain-div bar charts of **your own** data: focus time per day (7 / 30 day tabs, today's bar highlighted) and time per task (top few tasks, the rest grouped as "Other"). Redrawn on open, when a session finishes, and after a cloud sign-in merge.
- The timer uses an absolute `endAt` timestamp, so it stays accurate when the tab is in the background.
- The chime is a three-note C-E-G arpeggio made with Web Audio (no audio file). The `AudioContext` is created in `start()` because browsers only allow sound after a click.
- YouTube: the user adds a playlist or video link (public or unlisted) with a name via the ➕ button's popup (a name is required), and removes one with 🗑 (click twice); their playlist is edited on youtube.com, not in the app. Playlists shuffle and loop, and a single video restarts when it ends (shuffle is applied on the first PLAYING state, so the first song is always the list's first). Pause/resume continues the same song. Videos that refuse embedding (error 101/150) are skipped, up to 5 in a row; a single video shows ⚠️. No in-app search (YouTube removed it from the player; the Data API would need a public key and quota), no private playlists, no audio-only, ads may play, and mobile pauses it in the background. Some videos block embedding entirely, for example the Lofi Girl live stream.
- Music ducking: the music fades to 15% over the last 10 seconds of every interval, goes silent while the chime plays (`CHIME_MS`), then restores. Tunables are `FADE_MS` and `CHIME_MS` next to `applyVolume()` in `scripts/radio.js`. The volume slider sets `userVol`, and the fade is a fraction of it.
- Motivational quotes: the ✨ button (top-right, next to ⚙️) shows one gentle quote from the `QUOTES` list in `scripts/quotes.js`. It is opt-in only, never automatic, so the app stays calm. The quote drops in from the top of the screen over the background (top-centre on wide screens, left of the buttons on phones), fades out after `QUOTE_MS` (7s), and click dismisses it. A shuffled bag avoids repeats until every quote has been shown. To add quotes, append strings to `QUOTES`.
- Persisted in `localStorage`: saved YouTube links (`pomo-yt`), all-time total (`pomo-total`), sessions (`pomo-sessions`), per-day buckets (`pomo-days`), per-task totals (`pomo-tasks`), tag list (`pomo-tags`), current task (`pomo-task`), session history (`pomo-log`), leaderboard range (`pomo-lbrange`), stats chart range (`pomo-statsrange`), minutes settings (`pomo-mins`, restored and range-checked at load, bad data falls back to defaults), volume (`pomo-vol`) and station (`pomo-station`).


## Testing

No test suite. Verify in a real browser (Chrome DevTools MCP works well):

- Reload with cache ignored after edits, since the page is a `file://` URL.
- To test interval ends without waiting, override `Date.now` with an offset in the page, for example `Date.now = () => real() + off`, then move `off` forward. This is how the finish, auto-start and fade were tested.

## Gotchas

- Mode tab handlers are bound with `querySelectorAll('.modes button')`. Do not use `[data-mode]`, because `<body>` also has `data-mode` and every click would reset the timer.
- The settings panel closes on any click outside it (a document click listener at the bottom of `scripts/settings.js`).
- `body` must not use `overflow: hidden`, because the card can be taller than short screens. Only `overflow-x` is hidden.
- The Quicksand font comes from Google Fonts and needs internet. Offline it falls back to a system font and everything else still works.
- Autoplay: the radio and chime need a user click first. Start and Play music are those clicks.
- YouTube doesn't play from `file://` (embeds need a referrer). Test it on the deployed site or with `python3 -m http.server`.
- The YouTube player is hidden (1×1, `opacity: 0`, `#yt` in `stylesheet/radio.css`), which breaks YouTube's "visible, at least 200×200" rule. Fine for a personal app; if YouTube ever stops playing hidden players, make `#yt` visible at 200×200.
- Cache busting: every local stylesheet and script link in `index.html` ends in `?v=N`, so a deployed site doesn't serve stale files (GitHub Pages caches about 10 minutes). Before each deploy that changes a CSS or JS file, bump them all: `sed -i '' -E 's/\?v=[0-9]+/?v=3/g' index.html` (use the next number; on macOS/BSD `sed` the empty `''` after `-i` is required, else `-E` is eaten as the backup suffix and nothing changes). `index.html` itself can't be versioned, so it may still lag a few minutes.

## Ideas not done yet

- Make the "long break every 4 sessions" interval a setting.
- Add a keyboard shortcut for Start/Pause.
