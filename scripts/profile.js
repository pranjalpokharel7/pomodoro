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
  save();
  setMode('focus');
  $('board').replaceChildren();
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

// Push my score, then show everyone's. Signed out: show nothing.
async function sync() {
  if (!auth) return $('board').replaceChildren();
  try {
    await fetch(await url(`/${auth.uid}`), {
      method: 'PUT',
      body: JSON.stringify({ name: auth.name, total: Math.floor(total), sessions }),
    });
    const all = (await get('')) || {};
    $('board').replaceChildren(...Object.entries(all)
      .filter(([, v]) => typeof v?.name === 'string')
      .sort(([, a], [, b]) => (Number(b.total) || 0) - (Number(a.total) || 0) || a.name.localeCompare(b.name))
      .map(([uid, v], i) => {
        const s = document.createElement('span');
        s.textContent = `${i + 1}. ${v.name} ${hms(Number(v.total) || 0)}`;
        s.className = uid === auth?.uid ? 'on' : '';
        return s;
      }));
  } catch {
    if (!auth) $('board').replaceChildren();
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

  try {
    // New device starts at 0, so take the bigger of local and cloud instead of overwriting.
    const c = await get(`/${auth.uid}`);
    total = Math.max(total, c?.total || 0);
    sessions = Math.max(sessions, c?.sessions || 0);
  } catch { /* offline: sync() will push what we have */ }
  save();
  show();
  sync();
};

$('signout').onclick = async () => {
  await sync(); // push the latest score before this device forgets it
  signOut();
  $('email').focus();
};

sync();
setInterval(sync, 30000);

$('boardclose').onclick = $('boardbtn').onclick = () => $('lb').classList.toggle('shut');
