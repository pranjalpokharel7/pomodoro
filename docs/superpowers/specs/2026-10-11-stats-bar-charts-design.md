# Stats panel with bar charts — design

A collapsible stats panel showing two bar charts: **total focus time per day** and
**time spent per task**. Plain HTML/CSS/JS bars — no chart library, no dependency
(honours the project's no-build / no-framework red line).

## Goals

- See total time studied over time as a daily bar chart (toggle 7 / 30 days).
- See which task took how much time as a per-task bar chart (top tasks + "Other").
- Per-task totals persist beyond the 20-session history and sync across devices.

## Non-goals

- No chart library or build step.
- Per-task data is **not** shown on the shared leaderboard UI (only the current
  task is, as today) — it is synced for the owner's own cross-device stats, but the
  leaderboard rendering is unchanged.
- Break time is not charted (only focus time is tracked; `days`/`tasks` are focus-only).

## Data model

### New local store: `pomo-tasks`

A persistent per-task accumulator, kept in `localStorage` as a map:

```json
{ "<label>": { "ms": 0, "n": 0 } }
```

- `ms` — total focus milliseconds logged under that label.
- `n` — number of completed focus sessions under that label.
- Lives in `scripts/tasks.js` as a module-global `taskTotals` object, loaded at
  startup (`JSON.parse(localStorage.getItem('pomo-tasks')) || {}`, guarded by try/catch
  like `pomo-log` and `pomo-days`).
- Keys are raw labels (JS object keys allow any string). The label used is the same
  one `logFocus` already records: `taskText() || 'Focus'`.

### Reused: `pomo-days`

The daily chart reads the existing `days` global (`{ "YYYY-MM-DD": { ms, n } }`,
pruned to 30 days). No change to how it is written.

## Cloud sync (Firebase RTDB, existing REST pattern)

Per-task totals ride along on the user's existing score record at `/scores/<uid>`.

### Firebase key constraint → store as an array

RTDB keys cannot contain `.  #  $  [  ]  /`, and task labels are free text, so the
cloud copy **must not** be keyed by label. It is stored as an **array**:

```json
"tasks": [ { "label": "Thesis", "ms": 123000, "n": 4 }, ... ]
```

- **Local** representation stays the `{ label: { ms, n } }` map (easy to update).
- **On push** (`sync()` in `scripts/profile.js`): serialise the map to the array,
  flooring ms — `Object.entries(taskTotals).map(([label, t]) => ({ label, ms: Math.floor(t.ms) || 0, n: Math.floor(t.n) || 0 }))`.
- **On sign-in merge**: read the cloud `tasks` array and merge each entry into the
  local map, taking the max of `ms` and `n` per label (mirrors the existing
  `days`/`total` "max, don't overwrite" merge). Then `saveTasks()`.

### Privacy note (accepted)

The DB rules let every signed-in user read every `/scores` record, so syncing
per-task totals here makes the full task-label list readable by all signed-in users
(today only the *current* task is shared). This tradeoff was accepted; the data lives
on the score record, not a private path.

### Database rules addition

Add under `scores/$uid` (alongside the existing `days`/`active`/`task` validators):

```json
"tasks": {
  "$i": {
    ".validate": "newData.child('label').isString() && newData.child('label').val().length <= 60 && newData.child('ms').isNumber() && newData.child('n').isNumber()"
  }
}
```

(As with the other extra fields, this is optional hardening — RTDB accepts the
children without it — but it should be pasted into the console rules and documented
in `CLAUDE.md`.)

## Components

### `scripts/tasks.js` (edited)

- Add `taskTotals` global + `saveTasks()` (writes `pomo-tasks`).
- `logFocus(ms)`: after appending to the session log, also
  `taskTotals[label] ||= { ms: 0, n: 0 }; taskTotals[label].ms += ms; taskTotals[label].n++;`
  then `saveTasks()` and `window.renderStats?.()`.
- `clearHistory()`: also reset `taskTotals = {}` and `localStorage.removeItem('pomo-tasks')`
  (so both the 🗑️ clear and sign-out wipe it). Call `window.renderStats?.()` after.

### `scripts/profile.js` (edited)

- `sync()` PUT body: add the serialised `tasks` array (see above).
- Sign-in handler (`$('gate').onsubmit`): after merging `total`/`sessions`/`days`,
  merge the cloud `tasks` array into `taskTotals` (max per label), `saveTasks()`.
- No change needed to `signOut()` — it already calls `clearHistory()`, which now
  also clears `taskTotals`.
- After sign-in merge and after `sync()` fetch, call `window.renderStats?.()` so the
  panel reflects merged/cloud data.

### `scripts/stats.js` (new — rendering only)

Loaded **after `profile.js`, before `main.js`**. Reads globals: `days`, `dayKey`,
`hm`, `hms` (from `timer.js`) and `taskTotals` (from `tasks.js`). Exposes
`window.renderStats()`.

- **Range state**: `statsRange` = `'7' | '30'`, persisted as `pomo-statsrange`
  (default `'7'`), driven by the `#statstabs` buttons (same pattern as `#lbtabs`).
- **Daily chart** (`renderDaily()`): for `i` from `N-1` down to `0`, bucket
  `days[dayKey(Date.now() - i*86400000)]?.ms || 0`. Vertical bars; height ∝ ms / max.
  Today's bar highlighted. Bar title/label shows `hm(ms)`; x-axis shows a short day
  label. Empty state ("No focus time yet.") when all buckets are 0.
- **Task chart** (`renderTasks()`): `Object.entries(taskTotals)` sorted by `ms` desc;
  take top 6, sum the rest into a single `"Other"` row. Horizontal bars; width ∝
  ms / topMs; each row shows the label and `hm(ms)`. Empty state ("No sessions yet.")
  when the map is empty.
- `renderStats()` calls both; called on panel open, on `logFocus`, on clear, and from
  `profile.js` after sign-in/sync.

### `index.html` (edited)

- Add a `#stats` `<details>` fixed **bottom-left** (mirrors the top-left leaderboard
  trophy): a 📊 `<summary>` + a `.panel` containing the `#statstabs` (7 / 30), the
  daily chart container, and the task chart container. Toggles only via its own icon
  (no outside-click close, like the leaderboard).
- Only shown when signed in (same visibility handling as `#lb` — gated by
  `body.locked`).
- Add `<link>` for `stylesheet/charts.css` (after `stats.css`) and `<script>` for
  `scripts/stats.js` (after `profile.js`, before `main.js`).
- Bump every `?v=N` cache-buster on local CSS/JS links to the next number.

### `stylesheet/charts.css` (new)

Panel + both chart styles, matching the frosted-glass / accent-colour theme used by
`stats.css`. Loaded after `stats.css`.

### `CLAUDE.md` (edited)

Document: the new `pomo-tasks` store, the `tasks` field on `/scores/<uid>` (array of
`{label, ms, n}`) and its merge-on-sign-in, the `scripts/stats.js` + `charts.css`
additions and load order, the `#stats` element ids, the updated DB rules block, and
the `pomo-statsrange` persisted key.

## Data flow

1. A focus session finishes → `finish()` (timer.js) calls `logFocus(duration)`.
2. `logFocus` appends to the session log **and** adds to `taskTotals`, saves both,
   calls `renderStats()`.
3. `sync()` (every 30s + on start/pause/sign-in) pushes `total`/`sessions`/`days`/
   `tasks` to `/scores/<uid>`.
4. Opening the 📊 panel (or 7/30 toggle) calls `renderStats()` to draw bars from
   `days` and `taskTotals`.
5. Sign-in on a new device merges cloud `total`/`sessions`/`days`/`tasks` (max) into
   local, saves, renders.
6. 🗑️ clear or sign-out wipes `total`/`sessions`/`days` and (via `clearHistory`)
   `pomo-log`/`pomo-task`/`pomo-tasks`.

## Error / edge handling

- Missing/corrupt `pomo-tasks` → `try/catch` falls back to `{}` (as with `pomo-days`).
- No data → explicit empty-state text in each chart, no broken/zero-height bars.
- All bars scale to the max of the currently shown set; max of 0 → empty state (no
  divide-by-zero).
- Long task labels → truncated with CSS ellipsis in the task rows.
- Offline sign-in → merge is skipped (existing `catch`), `sync()` later pushes local.

## Testing (manual, per CLAUDE.md — no test suite)

- Seed `localStorage`: set `pomo-days` with a few dated buckets and `pomo-tasks` with
  a few labels, reload with cache ignored, open the 📊 panel.
- Verify: daily bars scale correctly, today highlighted, 7/30 toggle changes the set
  and persists across reload; task bars sorted desc, top-6 + "Other" grouping, labels
  and `hm` times correct.
- Finish a focus session (use the `Date.now` offset trick) and confirm the panel
  updates live via `renderStats()`.
- Empty state: clear everything (🗑️) and confirm both charts show their empty text.
- Cross-device: sign in on a second "device" (fresh localStorage) and confirm cloud
  `tasks` merge in.
```
