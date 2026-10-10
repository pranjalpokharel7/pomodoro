// Lofi radio, SomaFM streams. Station ids live in the #station dropdown.
const stationUrl = () => `https://ice1.somafm.com/${$('station').value}-128-mp3`;
const radio = new Audio();
const savedStation = localStorage.getItem('pomo-station');
if ([...$('station').options].some(o => o.value === savedStation)) $('station').value = savedStation;
let userVol = Number(localStorage.getItem('pomo-vol') ?? 0.5);
$('vol').value = userVol;

// Music fades over the last 10s of an interval, then goes silent while the chime plays.
const FADE_MS = 10000;
const CHIME_MS = 2600;
let quietUntil = 0;

function applyVolume() {
  let f = 1;
  if (Date.now() < quietUntil) f = 0;
  else if (timer && remaining < FADE_MS) f = Math.max(0.15, remaining / FADE_MS);
  radio.volume = userVol * f;
}
applyVolume();

// Silence the music while the chime plays.
function duckForChime() {
  quietUntil = Date.now() + CHIME_MS;
  applyVolume();
  setTimeout(applyVolume, CHIME_MS + 100);
}

// Same-size SVGs, so play and pause match (text glyphs differ in size).
const PLAY = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>`;
const PAUSE = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`;

const radioLabel = (icon, tip) => {
  $('music').innerHTML = icon;
  $('music').title = tip;
};

function radioStop(icon, tip) {
  // Drop the source so a live stream stops downloading and resumes live next time.
  radio.pause();
  radio.removeAttribute('src');
  radio.load();
  radioLabel(icon, tip);
}

function radioPlay() {
  const url = (radio.src = stationUrl());
  radioLabel(PAUSE, 'Pause lofi'); // show pause right away, the stream can take a while to start
  radio.play().catch(() => {
    // Ignore the abort from a newer station pick replacing this one.
    if (radio.src === url) radioStop('⚠️', 'Radio offline');
  });
}

$('music').onclick = () => (radio.src ? radioStop(PLAY, 'Play lofi') : radioPlay());

$('station').onchange = () => {
  localStorage.setItem('pomo-station', $('station').value);
  if (radio.src) radioPlay();
};

radio.onerror = () => radio.src && radioStop('⚠️', 'Radio offline');

$('vol').oninput = () => {
  userVol = Number($('vol').value);
  localStorage.setItem('pomo-vol', userVol);
  applyVolume();
};
