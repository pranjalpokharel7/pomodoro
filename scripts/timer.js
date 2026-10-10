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

function show() {
  $('time').textContent = clock(remaining);
  $('ring').style.strokeDashoffset = CIRC * (1 - remaining / duration(mode));
  $('total').textContent = hms(total);
  $('sessions').textContent = sessions;
  document.title = timer ? `${clock(remaining)} · ${TITLES[mode]}` : 'Pomodoro';
}

function save() {
  localStorage.setItem('pomo-total', total);
  localStorage.setItem('pomo-sessions', sessions);
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
  $('toggle').textContent = 'Start';
  applyVolume(); // back to full volume when paused or reset
}

function start() {
  // Browsers only allow sound after a click, so make the audio context here.
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
  endAt = Date.now() + remaining;
  lastTick = Date.now();
  timer = setInterval(tick, 250);
  $('toggle').textContent = 'Pause';
  show();
}

function pause() {
  tick();
  stop();
  show();
}

function tick() {
  const now = Date.now();
  if (mode === 'focus') total += now - lastTick;
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
    save();
    setMode(sessions % 4 === 0 ? 'long' : 'short');
  } else {
    setMode('focus');
  }
  start();
}

function beep() {
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
  if (!confirm('Clear total studied time and sessions?')) return;
  total = 0;
  sessions = 0;
  save();
  show();
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
