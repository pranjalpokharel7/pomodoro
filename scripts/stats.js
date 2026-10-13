// The stats panel: two plain-DOM bar charts drawn from data other scripts already keep.
//   - Daily focus time from `days` (scripts/timer.js), 7 or 30 day range.
//   - Time per task from `taskTotals` (scripts/tasks.js), top few + a grouped "Other".
// No chart library: bars are divs sized by percentage. renderStats() is called on panel open,
// when a session finishes (logFocus), on clear, and after a cloud sync/sign-in (profile.js).
// The #stats-user dropdown lets signed-in users view any other user's two charts. The data
// comes from window.getLastAll() (profile.js) — no extra network call.
const TOP_TASKS = 6;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

let statsRange = localStorage.getItem('pomo-statsrange') === '30' ? '30' : '7';
let viewingUser = null; // { days, tasks:{label:{ms,n}}, log } — null means own data

const mkEl = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const empty = (msg) => mkEl('p', 'chart-empty', msg);

// Refresh the user picker options from lastAll whenever we render.
function populateUserPick() {
  const sel = $('stats-user');
  if (!sel) return;
  const all = window.getLastAll?.() || {};
  const myUid = window.getAuthUid?.();
  const prev = sel.value;
  sel.replaceChildren();
  const mine = document.createElement('option');
  mine.value = '';
  mine.textContent = 'My stats';
  sel.append(mine);
  for (const [uid, v] of Object.entries(all)) {
    if (uid === myUid || typeof v?.name !== 'string') continue;
    const opt = document.createElement('option');
    opt.value = uid;
    opt.textContent = v.name;
    sel.append(opt);
  }
  // Restore previous selection if still in the list.
  if (prev && sel.querySelector(`[value="${prev}"]`)) sel.value = prev;
}

// Build a { dateKey → { label: ms } } map from the session log for stacked daily bars.
function buildDayTagMap() {
  const log = viewingUser?.log || window.getSessionLog?.() || [];
  const map = {};
  for (const s of log) {
    const dk = dayKey(s.at);
    if (!map[dk]) map[dk] = {};
    map[dk][s.label] = (map[dk][s.label] || 0) + s.ms;
  }
  return map;
}

// Vertical bars, oldest on the left through today on the right.
function renderDaily() {
  const daysData = viewingUser?.days || days;
  const box = $('daily');
  const n = statsRange === '30' ? 30 : 7;
  const cols = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = Date.now() - i * 86400000;
    cols.push({ ms: daysData[dayKey(t)]?.ms || 0, t, now: i === 0 });
  }
  const max = Math.max(...cols.map(c => c.ms));
  if (max === 0) return box.replaceChildren(empty('No focus time yet.'));

  const dayTagMap = buildDayTagMap();

  box.replaceChildren(...cols.map(c => {
    const col = mkEl('div', c.now ? 'col now' : 'col');
    col.title = `${dayKey(c.t)} · ${hm(c.ms)}`;
    const bar = mkEl('div', 'bar');
    bar.style.height = `${(c.ms / max) * 100}%`;

    const breakdown = dayTagMap[dayKey(c.t)];
    if (breakdown) {
      for (const [label, ms] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
        const seg = mkEl('div', 'seg');
        seg.style.height = `${(ms / c.ms) * 100}%`;
        seg.style.background = window.tagColor?.(label) || 'var(--accent)';
        bar.append(seg);
      }
    } else {
      const seg = mkEl('div', 'seg');
      seg.style.height = '100%';
      seg.style.background = c.now ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 55%, transparent)';
      bar.append(seg);
    }

    col.append(bar);
    if (n <= 7) col.append(mkEl('span', 'lbl', WEEKDAY[new Date(c.t).getDay()]));
    return col;
  }));
}

// Focus minutes in each hour of one day, cut from the segments. A segment can span hours.
function hourMs(segs, key) {
  const out = Array(24).fill(0);
  for (const g of segs) {
    for (let t = g.s; t < g.e;) {
      const d = new Date(t);
      const end = Math.min(g.e, new Date(d).setHours(d.getHours() + 1, 0, 0, 0));
      if (dayKey(t) === key) out[d.getHours()] += end - t;
      t = end;
    }
  }
  return out;
}

// 24 vertical bars, each out of a full 60 minutes.
function renderHours() {
  const key = $('hoursday').value || dayKey();
  const ms = hourMs(viewingUser?.segments || segments, key);
  const box = $('hours');
  if (!ms.some(Boolean)) return box.replaceChildren(empty('No hourly data for this day.'));
  box.replaceChildren(...ms.map((v, h) => {
    const col = mkEl('div', 'col');
    col.title = `${pad(h)}:00 · ${hm(v)}`;
    const bar = mkEl('div', 'bar');
    bar.style.height = `${(v / 3600000) * 100}%`;
    const seg = mkEl('div', 'seg');
    seg.style.height = '100%';
    seg.style.background = 'var(--accent)';
    bar.append(seg);
    col.append(bar, mkEl('span', 'lbl', h % 6 ? '\u00a0' : h));
    return col;
  }));
}
$('hoursday').value = dayKey();
$('hoursday').max = dayKey();
$('hoursday').onchange = renderHours;

// Horizontal bars, longest task first, the rest grouped as "Other".
function renderTasks() {
  const tasksData = viewingUser?.tasks || taskTotals;
  const box = $('bytask');
  const sorted = Object.entries(tasksData)
    .map(([label, t]) => ({ label, ms: Number(t.ms) || 0 }))
    .filter(x => x.ms > 0)
    .sort((a, b) => b.ms - a.ms);
  if (!sorted.length) return box.replaceChildren(empty('No sessions yet.'));

  const rows = sorted.slice(0, TOP_TASKS);
  const rest = sorted.slice(TOP_TASKS);
  if (rest.length) rows.push({ label: 'Other', ms: rest.reduce((s, x) => s + x.ms, 0), other: true });

  const max = rows[0].ms || 1;
  box.replaceChildren(...rows.map(r => {
    const row = mkEl('div', r.other ? 'trow other' : 'trow');
    const head = mkEl('div', 'head');
    head.append(mkEl('span', 'name', r.label), mkEl('span', 'val', hm(r.ms)));
    const track = mkEl('div', 'track');
    const fill = mkEl('div', 'fill');
    fill.style.width = `${(r.ms / max) * 100}%`;
    if (!r.other) fill.style.background = window.tagColor?.(r.label) || '';
    track.append(fill);
    row.append(head, track);
    return row;
  }));
}

// Render session history for whoever is selected: their log when viewing someone else,
// own log (via tasks.js) when back on "My stats".
function renderHistoryForView() {
  if (!viewingUser) { window.renderHistory?.(); return; }
  const log = (viewingUser.log || []).slice(0, 5);
  $('history').replaceChildren(...log.map(e => {
    const row = document.createElement('div');
    row.className = 'hrow';
    const lbl = document.createElement('span');
    lbl.className = 'hlabel';
    const color = window.tagColor?.(e.label);
    if (color) {
      const dot = document.createElement('span');
      dot.className = 'hdot';
      dot.style.background = color;
      lbl.append(dot);
    }
    lbl.append(document.createTextNode(e.label));
    const t = document.createElement('span');
    t.className = 'htime';
    t.textContent = hm(e.ms);
    row.append(lbl, t);
    return row;
  }));
}

function renderStats() {
  populateUserPick();
  renderDaily();
  renderHours();
  renderTasks();
  renderHistoryForView();
}
window.renderStats = renderStats;

// User picker: switching entries loads that user's data from lastAll into the charts.
const userSel = $('stats-user');
if (userSel) {
  userSel.onchange = () => {
    const uid = userSel.value;
    if (!uid) { viewingUser = null; renderStats(); return; }
    const v = (window.getLastAll?.() || {})[uid];
    if (!v) { viewingUser = null; renderStats(); return; }
    const tasks = {};
    for (const t of (Array.isArray(v.tasks) ? v.tasks : [])) {
      if (t?.label) tasks[t.label] = { ms: Number(t.ms) || 0, n: Number(t.n) || 0 };
    }
    viewingUser = { days: v.days || {}, tasks, log: Array.isArray(v.log) ? v.log : [],
      segments: (Array.isArray(v.segments) ? v.segments : []).filter(g => Number(g?.s) && Number(g?.e)) };
    renderStats();
  };
}

// Range tabs: 7 / 30 days.
document.querySelectorAll('#statstabs button').forEach(b => {
  b.classList.toggle('active', b.dataset.srange === statsRange);
  b.onclick = () => {
    statsRange = b.dataset.srange;
    localStorage.setItem('pomo-statsrange', statsRange);
    document.querySelectorAll('#statstabs button').forEach(x => x.classList.toggle('active', x === b));
    renderDaily();
  };
});

// Draw on open; reset picker to "My stats" on close. Persist open state across refreshes.
$('stats').addEventListener('toggle', () => {
  localStorage.setItem('pomo-stats-open', $('stats').open ? '1' : '');
  if ($('stats').open) {
    renderStats();
  } else {
    viewingUser = null;
    if (userSel) userSel.value = '';
  }
});

if (localStorage.getItem('pomo-stats-open')) {
  $('stats').open = true;
}
renderStats();
