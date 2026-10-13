// Email login + shared scoreboard: Firebase Auth and Realtime Database, both over plain REST, no SDK.
// Users and passwords live in the Firebase console. The display name is saved on the Firebase user at first sign-in.
// Real security lives in the database rules (see CLAUDE.md), not here.
const DB = 'https://pomodoro-c3e0a-default-rtdb.asia-southeast1.firebasedatabase.app/scores';
const KEY = 'AIzaSyCn8QCBOJGH3Daj29DAtd6Uthy_PeVg0FM'; // web API key, public by design
const SIGN_IN = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`;
const UPDATE = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${KEY}`;
const REFRESH = `https://securetoken.googleapis.com/v1/token?key=${KEY}`;

let auth = null; // { uid, name, id (ID token), refresh, exp (ms) }
try { auth = JSON.parse(localStorage.getItem('pomo-auth')); } catch {}
if (!auth?.uid) auth = null;
window.getAuthUid = () => auth?.uid;
window.getLastAll = () => lastAll;
$('email').value = localStorage.getItem('pomo-email') || '';

const postJson = (u, body) => fetch(u, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then(r => r.json());

// Signed out: only the full-screen sign-in shows. The UI is cosmetic, the database rules are the real lock.
const applyAuth = () => {
  document.body.classList.toggle('locked', !auth);
  $('signout').title = auth ? `Sign out (${auth.name})` : 'Sign out';
};
applyAuth();

const setAuth = (uid, name, id, refresh, secs) => {
  auth = { uid, name, id, refresh, exp: Date.now() + secs * 1000 - 60000 };
  localStorage.setItem('pomo-auth', JSON.stringify(auth));
  applyAuth();
};

// Also wipes this device's local totals (they're in the cloud), so the next person to sign in here doesn't inherit them.
const signOut = () => {
  auth = null;
  localStorage.removeItem('pomo-auth');
  stop();
  radioStop(PLAY, 'Play lofi');
  total = sessions = 0;
  days = {};
  segments = [];
  save();
  window.clearHistory?.(); // next person on this device starts with a clean task + history
  setMode('focus');
  clearBoard();
  applyAuth();
};

// ID tokens last an hour, so trade the refresh token for a new one when needed.
// A changed or revoked password makes the refresh fail, which signs this device out.
async function token() {
  if (Date.now() < auth.exp) return auth.id;
  const r = await (await fetch(REFRESH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refresh)}`,
  })).json();
  if (!r.id_token) { signOut(); throw new Error('signed out'); }
  setAuth(auth.uid, auth.name, r.id_token, r.refresh_token, +r.expires_in);
  return auth.id;
}

const url = async path => `${DB}${path}.json?auth=${await token()}`;
const get = async path => (await fetch(await url(path))).json();

// Leaderboard range: 'today' | 'week' | 'all'. Ranks everyone by the selected range's time.
let range = localStorage.getItem('pomo-lbrange') || 'all';
let lastAll = {}; // last fetched records, so switching tabs re-renders without a round trip
const rows = new Map(); // uid -> { el, ms } stable row elements, for FLIP reordering
const MEDALS = ['🥇', '🥈', '🥉'];
const PRESENT_MS = 75000; // a focus heartbeat newer than this shows the "focusing now" dot

const dayAgo = i => dayKey(Date.now() - i * 86400000); // dayKey/hm come from scripts/timer.js

// { ms, n } for one record in the active range. All-time uses the lifetime fields so it stays
// accurate past the 30-day window; Today/Week sum the per-day buckets.
function metric(v) {
  const d = v.days || {};
  if (range === 'all') return { ms: Number(v.total) || 0, n: Number(v.sessions) || 0 };
  if (range === 'today') { const t = d[dayKey()] || {}; return { ms: Number(t.ms) || 0, n: Number(t.n) || 0 }; }
  let ms = 0, n = 0;
  for (let i = 0; i < 7; i++) { const t = d[dayAgo(i)]; if (t) { ms += Number(t.ms) || 0; n += Number(t.n) || 0; } }
  return { ms, n };
}

// Consecutive days with focus time, ending today (or yesterday if today is still empty).
function streak(v) {
  const d = v.days || {};
  let i = 0;
  if (!(d[dayKey()]?.ms > 0)) { if (d[dayAgo(1)]?.ms > 0) i = 1; else return 0; }
  let s = 0;
  while (d[dayAgo(i)]?.ms > 0) { s++; i++; }
  return s;
}

const makeRow = () => {
  const el = document.createElement('div');
  el.className = 'entry';
  el.innerHTML = '<div class="who"><span class="rank"></span><span class="nm"></span><span class="dot"></span></div><div class="meta"></div><div class="doing"></div>';
  return el;
};
function fillRow(el, x, i) {
  el.classList.toggle('on', x.uid === auth?.uid);
  el.classList.toggle('live', x.live);
  el.querySelector('.rank').textContent = MEDALS[i] || `${i + 1}.`;
  el.querySelector('.nm').textContent = x.v.name;
  el.querySelector('.meta').textContent = `${hm(x.m.ms)} · 🔥 ${x.st}`;
  const doing = el.querySelector('.doing'); // what they're focusing on, only while live
  const task = x.live && x.v.task ? String(x.v.task) : '';
  doing.textContent = task;
  doing.style.display = task ? '' : 'none';
}

const clearBoard = () => { $('board').replaceChildren(); rows.clear(); };

// Render everyone, ranked by the active range, animating any rank changes with FLIP.
function renderBoard(all) {
  const board = $('board');
  const list = Object.entries(all)
    .filter(([, v]) => typeof v?.name === 'string')
    .map(([uid, v]) => ({ uid, v, m: metric(v), st: streak(v), live: Date.now() - (Number(v.active) || 0) < PRESENT_MS }))
    .sort((a, b) => b.m.ms - a.m.ms || a.v.name.localeCompare(b.v.name));

  const firstRects = new Map(); // FLIP: where each row sits before the reorder
  for (const [uid, r] of rows) firstRects.set(uid, r.el.getBoundingClientRect());

  const seen = new Set(list.map(x => x.uid));
  for (const [uid, r] of rows) if (!seen.has(uid)) { r.el.remove(); rows.delete(uid); }

  const bumped = [];
  list.forEach((x, i) => {
    let r = rows.get(x.uid);
    if (!r) { r = { el: makeRow(), ms: x.m.ms }; rows.set(x.uid, r); }
    fillRow(r.el, x, i);
    if (x.m.ms > r.ms) { bumped.push(r.el); r.el.classList.remove('flash'); }
    r.ms = x.m.ms;
    board.appendChild(r.el); // appending in rank order reorders the DOM
  });

  const moves = [];
  for (const [uid, r] of rows) {
    const first = firstRects.get(uid);
    if (!first) continue; // new row: no slide, just appears
    const dy = first.top - r.el.getBoundingClientRect().top;
    if (dy) { r.el.style.transition = 'none'; r.el.style.transform = `translateY(${dy}px)`; moves.push(r.el); }
  }
  requestAnimationFrame(() => {
    for (const el of moves) { el.style.transition = 'transform 0.4s ease'; el.style.transform = ''; }
    for (const el of bumped) el.classList.add('flash'); // flash rows whose time just ticked up
  });
}

// Other devices (e.g. the deployed site vs a local file) push too, so take the bigger of local and cloud instead of overwriting.
function mergeCloud(c) {
  total = Math.max(total, c?.total || 0);
  sessions = Math.max(sessions, c?.sessions || 0);
  for (const [k, t] of Object.entries(c?.days || {})) { // merge per-day buckets, max each
    const l = days[k] || { ms: 0, n: 0 };
    days[k] = { ms: Math.max(l.ms || 0, Number(t.ms) || 0), n: Math.max(l.n || 0, Number(t.n) || 0) };
  }
  for (const e of (Array.isArray(c?.tasks) ? c.tasks : [])) { // merge per-task totals, max each
    if (!e || typeof e.label !== 'string') continue;
    const l = taskTotals[e.label] || { ms: 0, n: 0 };
    taskTotals[e.label] = { ms: Math.max(l.ms || 0, Number(e.ms) || 0), n: Math.max(l.n || 0, Number(e.n) || 0) };
  }
  for (const g of (Array.isArray(c?.segments) ? c.segments : [])) { // union segments by start, longer end wins
    if (!g || !Number(g.s) || !Number(g.e)) continue;
    const l = segments.find(x => x.s === g.s);
    if (l) l.e = Math.max(l.e, g.e);
    else segments.push({ s: g.s, e: g.e });
  }
  segments.sort((a, b) => a.s - b.s);
  const seen = new Set(sessionLog.map(e => e.at)); // union session history by timestamp, newest first
  for (const e of (Array.isArray(c?.log) ? c.log : [])) {
    if (e && typeof e.label === 'string' && Number(e.at) && !seen.has(e.at)) sessionLog.push({ label: e.label, ms: Number(e.ms) || 0, at: e.at });
  }
  sessionLog = sessionLog.sort((a, b) => b.at - a.at).slice(0, LOG_KEPT);
  localStorage.setItem('pomo-log', JSON.stringify(sessionLog));
  renderHistory();
  saveTasks();
  save();
  show();
  window.renderTags?.(); // merged per-task labels become selectable tags
  window.renderStats?.();
}

// Pull and merge my cloud record, push my score (including per-day buckets and a focus heartbeat), then show everyone's.
async function sync() {
  if (!auth) return clearBoard();
  try {
    mergeCloud(await get(`/${auth.uid}`));
    await fetch(await url(`/${auth.uid}`), {
      method: 'PUT',
      body: JSON.stringify({
        name: auth.name,
        total: Math.floor(total),
        sessions,
        days: Object.fromEntries(Object.entries(days).map(([k, t]) => [k, { ms: Math.floor(t.ms) || 0, n: Math.floor(t.n) || 0 }])),
        // Per-task totals as an array, since RTDB keys can't hold free-text labels (scripts/tasks.js).
        tasks: Object.entries(taskTotals).map(([label, t]) => ({ label, ms: Math.floor(t.ms) || 0, n: Math.floor(t.n) || 0 })),
        segments: segments.map(g => ({ s: Math.floor(g.s), e: Math.floor(g.e) })),
        log: sessionLog.map(e => ({ label: e.label, ms: Math.floor(e.ms) || 0, at: e.at })),
        active: timer && mode === 'focus' ? Date.now() : 0,
        task: timer && mode === 'focus' ? taskText() : '', // shared current task, only while focusing
      }),
    });
    lastAll = (await get('')) || {};
    renderBoard(lastAll);
  } catch {
    if (!auth) clearBoard();
  }
}

$('gate').onsubmit = async e => {
  e.preventDefault();
  const email = $('email').value.trim();
  let d;
  try {
    d = await postJson(SIGN_IN, { email, password: $('pw').value, returnSecureToken: true });
  } catch { return alert('Could not reach the server'); }
  if (!d.idToken) return alert('Wrong email or password');
  $('pw').value = '';
  localStorage.setItem('pomo-email', email);

  let name = d.displayName;
  if (!name) { // first sign-in: ask once and keep the name on the Firebase user
    name = (prompt('First time here! What should we call you?') || '').trim().slice(0, 20) || email.split('@')[0].slice(0, 20);
    postJson(UPDATE, { idToken: d.idToken, displayName: name }).catch(() => {});
  }
  setAuth(d.localId, name, d.idToken, d.refreshToken, +d.expiresIn);

  sync();
};

$('signout').onclick = async () => {
  await sync(); // push the latest score before this device forgets it
  signOut();
  $('email').focus();
};

sync();
setInterval(sync, 30000);

// Persist leaderboard open state across refreshes.
$('lb').addEventListener('toggle', () => {
  localStorage.setItem('pomo-lb-open', $('lb').open ? '1' : '');
});
if (localStorage.getItem('pomo-lb-open')) $('lb').open = true;

// Range tabs: re-sort the board by Today / Week / All-time, remembering the choice.
document.querySelectorAll('#lbtabs button').forEach(b => {
  b.classList.toggle('active', b.dataset.range === range);
  b.onclick = () => {
    range = b.dataset.range;
    localStorage.setItem('pomo-lbrange', range);
    document.querySelectorAll('#lbtabs button').forEach(x => x.classList.toggle('active', x === b));
    renderBoard(lastAll);
  };
});
