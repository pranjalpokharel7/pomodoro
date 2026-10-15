// Music: saved YouTube links in the #station dropdown, values "yt:list:<id>" / "yt:video:<id>".
let playing = false;

// Saved YouTube links, [{ name, kind: 'list' | 'video', id }].
let ytLinks = [];
try { ytLinks = JSON.parse(localStorage.getItem('pomo-yt')) || []; } catch {}
const NEW_YT = '__yt__'; // sentinel value of the "add a link" option

function renderYt() {
  $('station').replaceChildren(
    ...(ytLinks.length ? [] : [new Option('🎵 No music yet', '')]),
    ...ytLinks.map(l => new Option(l.name, `yt:${l.kind}:${l.id}`)),
    new Option('➕ Add YouTube link…', NEW_YT),
  );
}
renderYt();

// Playlist link (list=) wins over the video in it; otherwise a watch, youtu.be, live, shorts or embed link.
function parseYouTube(link) {
  let u;
  try { u = new URL(link.trim()); } catch { return null; }
  if (!/(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname)) return null;
  const list = u.searchParams.get('list');
  if (list && /^[\w-]+$/.test(list)) return { kind: 'list', id: list };
  const id = u.hostname === 'youtu.be' ? u.pathname.slice(1)
    : u.searchParams.get('v') || u.pathname.match(/^\/(?:live|shorts|embed)\/([^/]+)/)?.[1];
  return /^[\w-]{11}$/.test(id) ? { kind: 'video', id } : null;
}

const savedStation = localStorage.getItem('pomo-station');
if ([...$('station').options].some(o => o.value === savedStation && o.value !== NEW_YT)) $('station').value = savedStation;
let lastStation = $('station').value;
let userVol = Number(localStorage.getItem('pomo-vol') ?? 0.5);
$('vol').value = userVol;

// Ask for a link, save it and select it. False if cancelled or not a YouTube link.
function addLink() {
  const link = prompt('Paste a YouTube playlist or video link (public or unlisted):');
  const p = link && parseYouTube(link);
  if (!p) {
    if (link) alert("That doesn't look like a YouTube playlist or video link.");
    $('station').value = lastStation;
    return false;
  }
  if (!ytLinks.some(l => l.id === p.id)) {
    const name = (prompt('Name it:', p.kind === 'list' ? 'My playlist' : 'YouTube video') || 'YouTube').trim().slice(0, 40);
    ytLinks.push({ name: `▶ ${name}`, ...p });
    localStorage.setItem('pomo-yt', JSON.stringify(ytLinks));
    renderYt();
  }
  $('station').value = lastStation = `yt:${p.kind}:${p.id}`;
  localStorage.setItem('pomo-station', lastStation);
  return true;
}

// Lazy-loaded YouTube player, hidden by CSS (#yt in stylesheet/radio.css).
let yt = null, ytReady = null, ytLoaded = '', ytFails = 0, ytShuffle = false;
function loadYt() {
  return (ytReady ??= new Promise((res, rej) => {
    window.onYouTubeIframeAPIReady = () => {
      yt = new YT.Player('yt', {
        width: 1, height: 1, playerVars: { playsinline: 1 },
        events: { onReady: res, onError: ytError, onStateChange: ytState },
      });
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytReady = null; s.remove(); rej(); };
    document.head.append(s);
  }));
}

function ytState(e) {
  if (e.data !== YT.PlayerState.PLAYING) return;
  ytFails = 0;
  // Shuffle only takes once the playlist has loaded, so the first song is always the list's first.
  if (ytShuffle) { ytShuffle = false; yt.setShuffle(true); yt.setLoop(true); }
}

// Skip videos that can't be embedded; give up on a single video or a run of failures.
function ytError() {
  if (yt.getPlaylist()?.length > 1 && ++ytFails < 5) yt.nextVideo();
  else { ytLoaded = ''; radioStop('⚠️', 'YouTube unavailable'); }
}

// Music fades over the last 10s of an interval, then goes silent while the chime plays.
const FADE_MS = 10000;
const CHIME_MS = 2600;
let quietUntil = 0;

function applyVolume() {
  let f = 1;
  if (Date.now() < quietUntil) f = 0;
  else if (timer && remaining < FADE_MS) f = Math.max(0.15, remaining / FADE_MS);
  yt?.setVolume?.(Math.round(userVol * f * 100));
}

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
  playing = false;
  yt?.pauseVideo?.();
  radioLabel(icon, tip);
}

function radioPlay() {
  const v = $('station').value;
  if (!v.startsWith('yt:') && !addLink()) return; // nothing saved yet: ask for a link first
  playing = true;
  radioLabel(PAUSE, 'Pause music'); // show pause right away, the player can take a while to start
  loadYt().then(() => {
    const v = $('station').value;
    if (!playing) return; // paused while loading
    applyVolume();
    if (ytLoaded === v) return yt.playVideo(); // resume where it paused
    ytLoaded = v;
    const [, kind, id] = v.split(':');
    if (kind === 'list') {
      ytShuffle = true;
      yt.loadPlaylist({ list: id, listType: 'playlist' });
    } else yt.loadVideoById(id);
  }, () => radioStop('⚠️', 'YouTube offline'));
}

$('music').onclick = () => (playing ? radioStop(PLAY, 'Play music') : radioPlay());

$('station').onchange = () => {
  if ($('station').value === NEW_YT) {
    if (!addLink()) return;
  } else {
    lastStation = $('station').value;
    localStorage.setItem('pomo-station', lastStation);
  }
  if (playing) radioPlay();
};

$('vol').oninput = () => {
  userVol = Number($('vol').value);
  localStorage.setItem('pomo-vol', userVol);
  applyVolume();
};
