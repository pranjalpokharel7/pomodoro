# Leaderboard v2 — Design

Date: 2026-10-11

A richer, livelier leaderboard: time-range views (Today / Week / All-time), richer rows
(medal, range time, sessions, streak), animated reordering, and "focusing now" presence dots.
Built within the project's red lines — plain HTML/CSS/JS, no build step, no dependencies,
Firebase over plain `fetch` (no SDK).

## Goals

- Rank users by Today, This week, or All-time, switchable with tabs in the card.
- Show per row: medal (🥇🥈🥉 then numbers), name, range time, 🍅 sessions, 🔥 streak.
- Animate rank changes (FLIP) and flash a row when its time ticks up.
- Show a pulsing green dot next to anyone currently in a focus session.

## Data model (Firebase `/scores/<uid>`)

Backward-compatible. Existing fields stay; two new fields are added.

| Field      | Type                               | Purpose                                                       |
|------------|------------------------------------|--------------------------------------------------------------|
| `name`     | string ≤ 20                        | display name (existing)                                       |
| `total`    | number                             | lifetime focus ms — powers **All-time** (existing)           |
| `sessions` | number                             | lifetime session count — powers **All-time** (existing)      |
| `days`     | `{ "YYYY-MM-DD": { ms, n } }`      | per-day focus ms + session count; client-pruned to last 30 days |
| `active`   | number                             | timestamp (ms) of last focus heartbeat; `0` when not focusing |

Each day holds both `ms` and `n` so range selection applies to time **and** sessions.
All-time uses lifetime `total`/`sessions` so it stays correct beyond the 30-day window.

### localStorage additions

- `pomo-days` — JSON of the local `days` map.
- `pomo-lbrange` — selected range tab: `today` | `week` | `all` (default `all`).

(existing: `pomo-total`, `pomo-sessions`, `pomo-mins`, `pomo-vol`, `pomo-station`,
`pomo-auth`, `pomo-email`.)

## Firebase rules (paste into console)

Keeps the current core validation; adds `days/$day` and `active`.

```json
{
  "rules": {
    "scores": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.child('total').isNumber() && newData.child('sessions').isNumber() && newData.child('name').isString() && newData.child('name').val().length <= 20",
        "days": {
          "$day": {
            ".validate": "newData.child('ms').isNumber() && newData.child('n').isNumber()"
          }
        },
        "active": { ".validate": "newData.isNumber()" }
      }
    }
  }
}
```

## Range views

Three small tabs in the `#lb` header: **Today · Week · All** (default All; saved to
`pomo-lbrange`). The board ranks by the active range's **time**, so switching tabs re-sorts
everyone.

- Today = `days[today].ms` / `.n`
- Week = sum of `ms` / `n` over the last 7 dates (today .. today-6)
- All = lifetime `total` / `sessions`

## Row content (two lines)

```
🥇 Aditi  ●                 ← medal (🥇🥈🥉, then "4." "5." …) + name + green presence dot
   2h 15m · 🍅 5 · 🔥 3     ← range time · sessions · day-streak
```

- Time uses a compact formatter (`Xh Ym`, or `Ym` under an hour, `0m` when zero).
- Streak = consecutive days (ending today, or yesterday if today is empty) with `ms > 0`,
  read from the `days` map (caps at 30 given the prune window).
- "You" is highlighted bold. The green dot means **presence**, not "you" — so the old
  `.on::before` accent dot is removed and replaced with a bold/accent treatment.

## Live feel

- **Animated reorder (FLIP):** rows become stable elements keyed by uid (not recreated each
  sync). On each render: measure old rects → update content + reorder DOM → measure new rects
  → animate the transform delta to zero. A row whose range time increased since last render
  flashes briefly.
- **Presence:** `sync()` writes `active = (timer && mode === 'focus') ? Date.now() : 0`.
  `start()` and `stop()` in `timer.js` fire an immediate `window.sync?.()` so dots appear
  within a click rather than waiting for the 30s interval. A user shows the pulsing dot when
  `Date.now() - active < 75000`.

## Client changes

- **`scripts/timer.js`**
  - `tick()`: when `mode === 'focus'`, add the delta to `days[today].ms` alongside `total`.
  - `finish()`: when a focus session completes, bump `days[today].n` alongside `sessions`.
  - `save()`: persist `pomo-days` (pruned to last 30 days).
  - Clear button and sign-out also wipe `days`.
  - `start()` / `stop()`: call `window.sync?.()` for prompt presence updates.
  - Add a compact time formatter for the board.
- **`scripts/profile.js`**
  - `sync()` PUT payload includes `days` and `active`.
  - Compute per-user range metrics + streak; rank by active range.
  - FLIP render with stable per-uid rows; tick-up flash; presence dots; medals.
  - Range tabs: wire clicks, persist selection, re-render immediately on change.
  - Sign-in merge: take max of local/cloud `total`/`sessions`, and merge `days` per date
    (max `ms`, max `n`).
  - Sign-out clears local `days`.
- **`index.html`:** range tabs inside `#lb header`. Bump all `?v=N` cache busters.
- **`stylesheet/stats.css`:** two-line rows, medals, range tabs, presence dot pulse,
  tick-up flash; repurpose the "you" highlight.

## Edge cases

- New device: sign-in takes the max per field and per-day, so it never overwrites a richer
  record.
- All-time accuracy is preserved beyond 30 days (uses lifetime `total`, not day sums).
- Multi-device concurrent writes: local `days` is authoritative on PUT (documented
  limitation; acceptable for this app's scale).
- Board must not be hidden by `.lb:has(.board:empty)` while signed in — rows are present
  after the first sync.

## Testing

No test suite (per CLAUDE.md). Verify in a real browser:

- Sign in; confirm rows render with medals, range time, sessions, streak.
- Switch Today / Week / All; confirm re-sort and value changes.
- Run a focus session (override `Date.now` to advance time) and confirm Today/streak update
  and the row flashes.
- Confirm the presence dot appears on start and clears on pause.
- Reload with cache ignored (file is served locally).

## Addendum — follow-up refinements (2026-10-11)

After the first build, these changes were made:

- **Sessions removed from the board:** the 🍅 session count was dropped from leaderboard rows
  entirely; a row now shows just `time · 🔥 streak` (e.g. `2h 15m · 🔥 3`). The session count
  still lives on the card's "Sessions" stat.
- **Card stats are per-day:** the card's "Total studied" was relabelled **"Today"** and now shows
  today's focus time; the "Sessions" stat likewise shows today's session count. All-time `total`
  still accrues for the leaderboard's *All* range. 🗑️ clears everything (total, sessions, days,
  task, history).
- **Per-session task label + history (`scripts/tasks.js`):** a `#task` pill under the ring
  (`pomo-task`); each completed focus session is logged to `#history` (`pomo-log`, last 20). The
  current task is pushed to the leaderboard (new `task` field) and shown under the live user's
  name. Validation added to the rules (`task` ≤ 60 chars).
- **Collapsible leaderboard:** `#lb` became a `<details>` with a round trophy `<summary>` and a
  dropdown `.panel`, matching the ⚙️/✨ icons; collapsed by default, closes on outside click.
  The old floating `#boardbtn` trophy and `#boardclose` ✕ were removed.
