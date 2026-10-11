// The stats panel: two plain-DOM bar charts drawn from data other scripts already keep.
//   - Daily focus time from `days` (scripts/timer.js), 7 or 30 day range.
//   - Time per task from `taskTotals` (scripts/tasks.js), top few + a grouped "Other".
// No chart library: bars are divs sized by percentage. renderStats() is called on panel open,
// when a session finishes (logFocus), on clear, and after a cloud sync/sign-in (profile.js).
const TOP_TASKS = 6; // tasks shown individually before the rest collapse into "Other"
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

let statsRange = localStorage.getItem('pomo-statsrange') === '30' ? '30' : '7';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const empty = (msg) => el('p', 'chart-empty', msg);

// Build a { dateKey → { label: ms } } map from the session log for stacked bars.
function buildDayTagMap() {
  const map = {};
  for (const s of (window.getSessionLog?.() || [])) {
    const dk = dayKey(s.at);
    if (!map[dk]) map[dk] = {};
    map[dk][s.label] = (map[dk][s.label] || 0) + s.ms;
  }
  return map;
}

// Vertical bars, oldest day on the left through today on the right. dayKey/hm from scripts/timer.js.
// Each bar is stacked with coloured segments per tag when session-log data is available.
function renderDaily() {
  const box = $('daily');
  const n = statsRange === '30' ? 30 : 7;
  const cols = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = Date.now() - i * 86400000;
    cols.push({ ms: days[dayKey(t)]?.ms || 0, t, now: i === 0 });
  }
  const max = Math.max(...cols.map(c => c.ms));
  if (max === 0) return box.replaceChildren(empty('No focus time yet.'));

  const dayTagMap = buildDayTagMap();

  box.replaceChildren(...cols.map(c => {
    const col = el('div', c.now ? 'col now' : 'col');
    col.title = `${dayKey(c.t)} · ${hm(c.ms)}`;
    const bar = el('div', 'bar');
    bar.style.height = `${(c.ms / max) * 100}%`;

    const breakdown = dayTagMap[dayKey(c.t)];
    if (breakdown) {
      for (const [label, ms] of Object.entries(breakdown).sort((a, b) => b[1] - a[1])) {
        const seg = el('div', 'seg');
        seg.style.height = `${(ms / c.ms) * 100}%`;
        seg.style.background = window.tagColor?.(label) || 'var(--accent)';
        bar.append(seg);
      }
    } else {
      // Day predates the session log — fall back to a plain accent segment.
      const seg = el('div', 'seg');
      seg.style.height = '100%';
      seg.style.background = c.now ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 55%, transparent)';
      bar.append(seg);
    }

    col.append(bar);
    if (n <= 7) col.append(el('span', 'lbl', WEEKDAY[new Date(c.t).getDay()]));
    return col;
  }));
}

// Horizontal bars, longest task first, with everything past the top few grouped into "Other".
function renderTasks() {
  const box = $('bytask');
  const sorted = Object.entries(taskTotals)
    .map(([label, t]) => ({ label, ms: Number(t.ms) || 0 }))
    .filter(x => x.ms > 0)
    .sort((a, b) => b.ms - a.ms);
  if (!sorted.length) return box.replaceChildren(empty('No sessions yet.'));

  const rows = sorted.slice(0, TOP_TASKS);
  const rest = sorted.slice(TOP_TASKS);
  if (rest.length) rows.push({ label: 'Other', ms: rest.reduce((s, x) => s + x.ms, 0), other: true });

  const max = rows[0].ms || 1;
  box.replaceChildren(...rows.map(r => {
    const row = el('div', r.other ? 'trow other' : 'trow');
    const head = el('div', 'head');
    head.append(el('span', 'name', r.label), el('span', 'val', hm(r.ms)));
    const track = el('div', 'track');
    const fill = el('div', 'fill');
    fill.style.width = `${(r.ms / max) * 100}%`;
    if (!r.other) fill.style.background = window.tagColor?.(r.label) || '';
    track.append(fill);
    row.append(head, track);
    return row;
  }));
}

function renderStats() {
  renderDaily();
  renderTasks();
}
window.renderStats = renderStats;

// Range tabs: 7 / 30 days, remembering the choice (mirrors the leaderboard's range tabs).
document.querySelectorAll('#statstabs button').forEach(b => {
  b.classList.toggle('active', b.dataset.srange === statsRange);
  b.onclick = () => {
    statsRange = b.dataset.srange;
    localStorage.setItem('pomo-statsrange', statsRange);
    document.querySelectorAll('#statstabs button').forEach(x => x.classList.toggle('active', x === b));
    renderDaily();
  };
});

// Draw when the panel is first opened (and keep it fresh on later opens).
$('stats').addEventListener('toggle', () => { if ($('stats').open) renderStats(); });

renderStats();
