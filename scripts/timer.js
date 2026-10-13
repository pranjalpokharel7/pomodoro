const CIRC = 2 * Math.PI * 54;
const TITLES = { focus: 'Focus', short: 'Short break', long: 'Long break' };
const inputs = { focus: $('focusMin'), short: $('shortMin'), long: $('longMin') };

let mode = 'focus';
let remaining = 0; // ms left on the current interval
let endAt = null; // timestamp the interval ends, only while running
let lastTick = 0;
let timer = null;
let audio = null;
let total = Number(localStorage.getItem('pomo-total')) || 0; // ms of focus time
let sessions = Number(localStorage.getItem('pomo-sessions')) || 0;
// Per-day focus, { "YYYY-MM-DD": { ms, n } }, kept to the last 30 days. Powers the leaderboard's
// Today/Week ranges and streaks. The leaderboard reads this; see scripts/profile.js.
let days = {};
try { days = JSON.parse(localStorage.getItem('pomo-days')) || {}; } catch {}
const DAYS_KEPT = 30;
// Focus segments, [{ s, e }] in ms: one per Start-to-stop run, grown on every tick so a crash loses
// at most a tick. Powers the hourly chart (scripts/stats.js). Kept for DAYS_KEPT days.
let segments = [];
try { segments = JSON.parse(localStorage.getItem('pomo-segments')) || []; } catch {}

const duration = m => Math.max(1, Number(inputs[m].value) || 1) * 60000;

const pad = n => String(n).padStart(2, '0');
const clock = ms => {
  const s = Math.ceil(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
const hms = ms => {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
};
// Compact duration for the leaderboard: "2h 15m", or "15m" under an hour.
const hm = ms => {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

// Local-time date key, driven by Date.now() so the Date.now override used in testing works.
const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const today = () => (days[dayKey()] ||= { ms: 0, n: 0 });
function pruneDays() {
  const keep = new Set();
  for (let i = 0; i < DAYS_KEPT; i++) keep.add(dayKey(Date.now() - i * 86400000));
  for (const k of Object.keys(days)) if (!keep.has(k)) delete days[k];
}

function show() {
  $('time').textContent = clock(remaining);
  $('ring').style.strokeDashoffset = CIRC * (1 - remaining / duration(mode));
  $('total').textContent = hms(days[dayKey()]?.ms || 0); // the card shows today, not all-time
  $('sessions').textContent = days[dayKey()]?.n || 0;
  document.title = timer ? `${clock(remaining)} · ${TITLES[mode]}` : 'Pomodoro';
}

function save() {
  localStorage.setItem('pomo-total', total);
  localStorage.setItem('pomo-sessions', sessions);
  pruneDays();
  localStorage.setItem('pomo-days', JSON.stringify(days));
  const cutoff = Date.now() - DAYS_KEPT * 86400000;
  segments = segments.filter(g => g.e >= cutoff);
  localStorage.setItem('pomo-segments', JSON.stringify(segments));
}

function setMode(m) {
  mode = m;
  remaining = duration(m);
  document.body.dataset.mode = m;
  $('skip').hidden = m === 'focus';
  document.querySelectorAll('.modes button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  show();
}

function stop() {
  clearInterval(timer);
  timer = null;
  endAt = null;
  localStorage.removeItem('pomo-running');
  $('toggle').textContent = 'Start';
  applyVolume(); // back to full volume when paused or reset
  window.sync?.(); // clear this device's "focusing now" dot on the leaderboard
}

function start() {
  // Browsers only allow sound after a click, so make the audio context here.
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
  endAt = Date.now() + remaining;
  localStorage.setItem('pomo-running', JSON.stringify({ endAt, mode }));
  lastTick = Date.now();
  timer = setInterval(tick, 250);
  $('toggle').textContent = 'Pause';
  show();
  window.sync?.(); // light up this device's "focusing now" dot without waiting for the 30s sync
}

function pause() {
  tick();
  stop();
  show();
}

function tick() {
  const now = Date.now();
  if (mode === 'focus') {
    total += now - lastTick;
    today().ms += now - lastTick;
    const last = segments[segments.length - 1];
    if (last?.e === lastTick) last.e = now; // same run: extend it, else Start opened a new one
    else segments.push({ s: lastTick, e: now });
  }
  lastTick = now;
  remaining = Math.max(0, endAt - now);
  if (remaining === 0) return finish();
  applyVolume();
  save();
  show();
}

function finish() {
  stop();
  beep();
  duckForChime();
  if (mode === 'focus') {
    sessions++;
    today().n++;
    save();
    window.logFocus?.(duration('focus')); // record this session in the history log (see scripts/tasks.js)
    setMode(sessions % 4 === 0 ? 'long' : 'short');
  } else {
    setMode('focus');
  }
  start();
}

function beep() {
  if (!audio) return; // no AudioContext yet if timer was restored after a refresh without a click
  // Three soft chimes, scheduled on the audio clock.
  // C-E-G arpeggio, sine waves with a long soft fade.
  [523, 659, 784].forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const at = audio.currentTime + i * 0.5;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.7, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 1.4);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 1.4);
  });
}

$('toggle').onclick = () => (timer ? pause() : start());

$('skip').onclick = () => {
  stop();
  setMode('focus');
  start();
};

$('clear').onclick = () => {
  if (!confirm('Clear all your stats and session history?')) return;
  total = 0;
  sessions = 0;
  days = {};
  segments = [];
  save();
  window.clearHistory?.(); // also wipe the session history and current task
  show();
  window.sync?.(true); // push the wipe without merging the cloud copy back in
};

$('reset').onclick = () => {
  stop();
  setMode(mode);
};

document.querySelectorAll('.modes button').forEach(b => {
  b.onclick = () => {
    if (timer && !confirm('Timer is running. Switch and reset it?')) return;
    stop();
    setMode(b.dataset.mode);
  };
});
