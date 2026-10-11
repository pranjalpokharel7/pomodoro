// Per-session task label + a local history of completed focus sessions.
// The current task is also pushed to the leaderboard (see scripts/profile.js) so others can see
// what you're focusing on. History stays on this device only.
const LOG_KEPT = 20; // most recent completed sessions to keep

let sessionLog = [];
try { sessionLog = JSON.parse(localStorage.getItem('pomo-log')) || []; } catch {}

$('task').value = localStorage.getItem('pomo-task') || '';

// The current label, capped to match the leaderboard field. Read by profile.js when syncing.
const taskText = () => $('task').value.trim().slice(0, 60);

// Record a finished focus session. Called by finish() in scripts/timer.js.
function logFocus(ms) {
  sessionLog.unshift({ label: taskText() || 'Focus', ms, at: Date.now() });
  sessionLog = sessionLog.slice(0, LOG_KEPT);
  localStorage.setItem('pomo-log', JSON.stringify(sessionLog));
  renderHistory();
}

// Wipe the log and the current task. Called on 🗑️ clear (timer.js) and sign-out (profile.js).
function clearHistory() {
  sessionLog = [];
  localStorage.removeItem('pomo-log');
  localStorage.removeItem('pomo-task');
  $('task').value = '';
  renderHistory();
}

function renderHistory() {
  $('history').replaceChildren(...sessionLog.map(e => {
    const row = document.createElement('div');
    row.className = 'hrow';
    const label = document.createElement('span');
    label.className = 'hlabel';
    label.textContent = e.label;
    const time = document.createElement('span');
    time.className = 'htime';
    time.textContent = hm(e.ms); // compact "25m" / "1h 5m", from scripts/timer.js
    row.append(label, time);
    return row;
  }));
}

// Remember the label locally as it's typed; push to the leaderboard when editing finishes.
$('task').oninput = () => localStorage.setItem('pomo-task', $('task').value);
$('task').onchange = () => { localStorage.setItem('pomo-task', $('task').value); window.sync?.(); };

renderHistory();
