// Music: saved YouTube links in the #station dropdown, values "yt:list:<id>" / "yt:video:<id>".
let playing = false;

// Saved YouTube links, [{ name, kind: 'list' | 'video', id }].
let ytLinks = [];
try { ytLinks = JSON.parse(localStorage.getItem('pomo-yt')) || []; } catch {}
function renderYt() {
  $('station').replaceChildren(
    ...(ytLinks.length ? [] : [new Option('🎵 No music yet', '')]),
    ...ytLinks.map(l => new Option(l.name, `yt:${l.kind}:${l.id}`)),
  );
  $('ytdel').hidden = !ytLinks.length;
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
if ([...$('station').options].some(o => o.value === savedStation)) $('station').value = savedStation;
let lastStation = $('station').value;
let userVol = Number(localStorage.getItem('pomo-vol') ?? 0.5);
$('vol').value = userVol;

// Add-link popup (a styled <dialog> in place of prompt/alert). Both a valid link and a name are required.
function openForm() {
  $('yterr').textContent = '';
  $('ytdlg').showModal();
}

const closeForm = () => $('ytdlg').close();
$('ytdlg').onclose = () => {
  $('ytform').reset();
  delete $('ytform').dataset.play;
};
$('ytdlg').onclick = e => e.target === $('ytdlg') && closeForm(); // backdrop click
$('ytadd').onclick = openForm;

$('ytform').onsubmit = e => {
  e.preventDefault();
  const p = parseYouTube($('ytlink').value);
  const name = $('ytname').value.trim();
  if (!p) return ($('yterr').textContent = "That doesn't look like a YouTube playlist or video link.");
  if (!name) return ($('yterr').textContent = 'Give it a name.');
  if (!ytLinks.some(l => l.id === p.id)) {
    ytLinks.push({ name: `▶ ${name}`, ...p });
    localStorage.setItem('pomo-yt', JSON.stringify(ytLinks));
    renderYt();
  }
  $('station').value = lastStation = `yt:${p.kind}:${p.id}`;
  localStorage.setItem('pomo-station', lastStation);
  const play = playing || $('ytform').dataset.play;
  closeForm();
  if (play) radioPlay();
};

// Remove the selected link: first click arms the button, a second click within 3s removes.
let delTimer = 0;
$('ytdel').onclick = () => {
  if (!$('ytdel').classList.contains('active')) {
    $('ytdel').classList.add('active');
    $('ytdel').title = 'Click again to remove';
    delTimer = setTimeout(disarmDel, 3000);
    return;
  }
  disarmDel();
  ytLinks = ytLinks.filter(l => `yt:${l.kind}:${l.id}` !== lastStation);
  localStorage.setItem('pomo-yt', JSON.stringify(ytLinks));
  renderYt(); // selects the first remaining link, or the placeholder
  if (playing) radioStop(PLAY, 'Play music');
  ytLoaded = '';
  lastStation = $('station').value;
  localStorage.setItem('pomo-station', lastStation);
};

function disarmDel() {
  clearTimeout(delTimer);
  $('ytdel').classList.remove('active');
  $('ytdel').title = 'Remove this link';
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
  // Playlists loop via setLoop; a single video just restarts.
  if (e.data === YT.PlayerState.ENDED && playing && ytLoaded.startsWith('yt:video:')) return yt.seekTo(0);
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
  if (!v.startsWith('yt:')) { // nothing saved yet: ask for a link first, play once it's saved
    $('ytform').dataset.play = 1;
    return openForm();
  }
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
  lastStation = $('station').value;
  localStorage.setItem('pomo-station', lastStation);
  disarmDel();
  if (playing) radioPlay();
};

$('vol').oninput = () => {
  userVol = Number($('vol').value);
  localStorage.setItem('pomo-vol', userVol);
  applyVolume();
};
