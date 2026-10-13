// Pastel palette for tag colours — avoids the three accent hues
// (focus pink #ff7fa3, short-break teal #5fcfa5, long-break blue #7f9cff).
const TAG_COLORS = [
  '#f4a96a', // peach
  '#b39ddb', // soft purple
  '#f7c96e', // butter yellow
  '#ef9a9a', // dusty rose
  '#a5d6a7', // soft sage
  '#80cbc4', // muted aqua
  '#ce93d8', // lilac
  '#ffcc80', // warm apricot
  '#90caf9', // powder blue
  '#f48fb1', // blush
];

function tagColor(label) {
  if (!label) return null;
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return TAG_COLORS[h % TAG_COLORS.length];
}
window.tagColor = tagColor;

// Per-session task label + a local history of completed focus sessions.
// The current task is also pushed to the leaderboard (see scripts/profile.js) so others can see
// what you're focusing on. History is synced to the cloud too (see mergeCloud in scripts/profile.js).
const LOG_KEPT = 20; // most recent completed sessions to keep

let sessionLog = [];
try { sessionLog = JSON.parse(localStorage.getItem('pomo-log')) || []; } catch {}

// Persistent per-task focus totals, { "<label>": { ms, n } }. Unlike sessionLog this is not
// capped, so it powers the all-time per-task bar chart (see scripts/stats.js). Synced to the cloud
// as an array by scripts/profile.js, since RTDB keys can't hold free-text labels.
let taskTotals = {};
try { taskTotals = JSON.parse(localStorage.getItem('pomo-tasks')) || {}; } catch {}
const saveTasks = () => localStorage.setItem('pomo-tasks', JSON.stringify(taskTotals));

// Tags you pick from instead of retyping a label. The #task dropdown is built from these plus any
// labels already in taskTotals (so tags from a synced device show up too). pomo-tags only needs to
// hold freshly created, not-yet-used tags; used ones survive via taskTotals.
let tags = [];
try { tags = JSON.parse(localStorage.getItem('pomo-tags')) || []; } catch {}
const saveTags = () => localStorage.setItem('pomo-tags', JSON.stringify(tags));
const NEW_TAG = '__new__'; // sentinel value of the "add a tag" option

// The current label, capped to match the leaderboard field. Read by profile.js when syncing.
const taskText = () => $('task').value.trim().slice(0, 60);

// Rebuild the dropdown: a blank "no tag" option, every known tag (sorted), then "➕ New tag…".
// `sel` is the tag to leave selected; defaults to the current pick, falling back to pomo-task.
function updateTaskBorder() {
  $('task').style.borderColor = tagColor(taskText()) || '';
}

function renderTags(sel) {
  const cur = sel ?? ($('task').value || localStorage.getItem('pomo-task') || '');
  const names = new Set([...tags, ...Object.keys(taskTotals)].filter(Boolean));
  if (cur) names.add(cur);
  const opts = [new Option('What are you working on?', '')];
  for (const n of [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))) {
    opts.push(new Option(n, n));
  }
  opts.push(new Option('➕ New tag…', NEW_TAG));
  $('task').replaceChildren(...opts);
  $('task').value = cur;
  updateTaskBorder();
}
window.renderTags = renderTags; // profile.js calls this after a sign-in merge brings in new tags
window.getSessionLog = () => sessionLog; // stats.js reads this to build per-day tag breakdowns

// Record a finished focus session. Called by finish() in scripts/timer.js.
function logFocus(ms) {
  const label = taskText() || 'Focus';
  sessionLog.unshift({ label, ms, at: Date.now() });
  sessionLog = sessionLog.slice(0, LOG_KEPT);
  localStorage.setItem('pomo-log', JSON.stringify(sessionLog));
  const t = (taskTotals[label] ||= { ms: 0, n: 0 }); // accumulate for the per-task chart
  t.ms += ms;
  t.n++;
  saveTasks();
  renderHistory();
  renderTags(); // a brand-new label becomes a selectable tag
  window.renderStats?.();
}

// Wipe the log and the current task. Called on sign-out (profile.js).
function clearHistory() {
  sessionLog = [];
  taskTotals = {};
  tags = [];
  localStorage.removeItem('pomo-log');
  localStorage.removeItem('pomo-task');
  localStorage.removeItem('pomo-tasks');
  localStorage.removeItem('pomo-tags');
  renderHistory();
  renderTags('');
  window.renderStats?.();
}

function renderHistory() {
  const rows = sessionLog.map(e => {
    const row = document.createElement('div');
    row.className = 'hrow';
    const label = document.createElement('span');
    label.className = 'hlabel';
    const color = tagColor(e.label);
    if (color) {
      const dot = document.createElement('span');
      dot.className = 'hdot';
      dot.style.background = color;
      label.append(dot);
    }
    label.append(document.createTextNode(e.label));
    const time = document.createElement('span');
    time.className = 'htime';
    time.textContent = hm(e.ms); // compact "25m" / "1h 5m", from scripts/timer.js
    row.append(label, time);
    return row;
  });
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'chart-empty';
    p.textContent = 'No sessions yet';
    rows.push(p);
  }
  $('history').replaceChildren(...rows);
}

// Picking a tag sets the current label (and pushes it to the leaderboard). Choosing "➕ New tag…"
// prompts for a name, saves it as a tag, and selects it; cancelling reverts the selection.
$('task').onchange = () => {
  const v = $('task').value;
  if (v === NEW_TAG) {
    const name = (prompt('New tag name') || '').trim().slice(0, 60);
    if (!name) return renderTags(); // cancelled or empty: revert to the previous pick
    if (!tags.includes(name)) { tags.push(name); saveTags(); }
    localStorage.setItem('pomo-task', name);
    renderTags(name);
    window.sync?.();
    return;
  }
  localStorage.setItem('pomo-task', v);
  updateTaskBorder();
  window.sync?.();
};

renderTags();
renderHistory();
