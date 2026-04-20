// ══════════════════════════════════════════════════
//  KAALI RAAT — Firebase + Google Auth
//  Apna Firebase config yahan fill karo (Step 4 dekho)
// ══════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC4G3cBS6fTmi7PXRrCbQPIkEbr-bh_470",
  authDomain: "fir-c929f.firebaseapp.com",
  projectId: "fir-c929f",
  storageBucket: "fir-c929f.firebasestorage.app",
  messagingSenderId: "82713990557",
  appId: "1:82713990557:web:d4586900ad445cb8a2cb74",
  measurementId: "G-SYRNS1D7BJ"
};

// ── Whitelist (optional) ─────────────────────────
// Sirf inhe login allow karo. Khali = sab allow.
const ALLOWED_EMAILS = [];

// ── Firebase Imports ─────────────────────────────
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, deleteDoc,
  collection, getDocs,
  query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Init ─────────────────────────────────────────
const _app      = initializeApp(FIREBASE_CONFIG);
const auth      = getAuth(_app);
const db        = getFirestore(_app);
const provider  = new GoogleAuthProvider();

let currentUser     = null;
let _readyCallbacks = [];
let _dbReady        = false;

// ── Auth State ───────────────────────────────────
let _authResolved = false;

onAuthStateChanged(auth, async (user) => {
  // Hide loading screen on first resolution
  if (!_authResolved) {
    _authResolved = true;
    const loading = document.getElementById('authLoading');
    if (loading) loading.style.display = 'none';
  }

  if (user) {
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email)) {
      await signOut(auth);
      _showAuth();
      _showAuthErr("❌ Is email ko access nahi hai.");
      return;
    }
    currentUser = user;
    _renderHeader(user);
    _hideAuth();
    _dbReady = true;
    _readyCallbacks.forEach(cb => cb());
    _readyCallbacks = [];
  } else {
    currentUser = null;
    _showAuth();
  }
});

// ── Google Login ─────────────────────────────────
window.googleLogin = async function () {
  const btn = document.getElementById('googleLoginBtn');
  const err = document.getElementById('authError');
  if (err) err.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Login ho raha hai...'; }
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.3 30.2 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.8 6c1.8-5.4 6.8-9.8 13.5-9.8z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.3-4 6.8-9.9 7.2-16.6z"/>
        <path fill="#FBBC05" d="M10.5 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6.1z"/>
        <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.6 0-12.2-4.5-14.2-10.4l-7.8 6.1C6.7 42.6 14.7 48 24 48z"/>
      </svg> 🔐 Google se Login Karo`;
    }
    let msg = "Login fail. Dobara try karo.";
    if (e.code === 'auth/popup-closed-by-user')  msg = "Popup band kar diya.";
    if (e.code === 'auth/network-request-failed') msg = "Internet check karo.";
    if (e.code === 'auth/popup-blocked')          msg = "Popup block hai — browser mein allow karo.";
    _showAuthErr("⚠️ " + msg);
  }
};

// ── Logout ───────────────────────────────────────
window.logoutUser = async function () {
  if (!confirm("Logout karna chahte ho?")) return;
  await signOut(auth);
};

// ── UI Helpers ───────────────────────────────────
function _showAuth() {
  const a = document.getElementById('authScreen');
  const c = document.getElementById('appContent');
  if (a) a.style.display = 'flex';
  if (c) c.style.display = 'none';
}
function _hideAuth() {
  const a = document.getElementById('authScreen');
  const c = document.getElementById('appContent');
  if (a) a.style.display = 'none';
  if (c) c.style.display = '';
  if (window._appLoad) window._appLoad();
}
function _renderHeader(user) {
  const av  = document.getElementById('userAvatar');
  const avF = document.getElementById('userAvatarFallback');
  const nm  = document.getElementById('userName');

  const displayName = user.displayName || user.email || 'User';
  if (nm) nm.textContent = displayName;

  if (user.photoURL) {
    // Show real photo
    if (av)  { av.src = user.photoURL; av.style.display = 'block'; }
    if (avF) avF.style.display = 'none';
  } else {
    // Gmail-style: colored circle with initial
    if (av)  av.style.display = 'none';
    if (avF) {
      const initial = displayName.charAt(0).toUpperCase();
      avF.textContent = initial;
      avF.style.display = 'flex';
      // Pick color based on initial char code
      const colors = ['#8800aa','#c0392b','#1a6b8a','#27ae60','#d35400','#8e44ad'];
      avF.style.background = colors[initial.charCodeAt(0) % colors.length];
    }
  }
}
function _showAuthErr(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── DB Ready ─────────────────────────────────────
window.db_onReady = function (cb) {
  if (_dbReady) cb();
  else _readyCallbacks.push(cb);
};

// ── Path Helpers ─────────────────────────────────
function uDoc(...path) {
  if (!currentUser) throw new Error('Not logged in');
  return doc(db, 'users', currentUser.uid, ...path);
}
function uCol(...path) {
  if (!currentUser) throw new Error('Not logged in');
  return collection(db, 'users', currentUser.uid, ...path);
}

// ── STATE ────────────────────────────────────────
window.db_saveState = async function (stateObj) {
  try { await setDoc(uDoc('meta', 'state'), stateObj, { merge: true }); }
  catch (e) { console.warn('[db] saveState fail', e); }
};

window.db_loadState = async function () {
  try {
    const snap = await getDoc(uDoc('meta', 'state'));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
};

// ── EPISODES ─────────────────────────────────────
// analysis.js calls: db_saveEpisode(ep) — ep.id is inside the object
window.db_saveEpisode = async function (ep) {
  try {
    const epId = ep.id || Date.now().toString();
    const ref = uDoc('episodes', epId);
    await setDoc(ref, { ...ep, id: epId }, { merge: true });
  } catch (e) { console.warn('[db] saveEpisode fail', e); }
};

window.db_getEpisodes = async function () {
  try {
    const q    = query(uCol('episodes'), orderBy('savedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) {
    // Fallback: no index yet, get without ordering
    try {
      const snap = await getDocs(uCol('episodes'));
      const eps  = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      return eps.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    } catch (e2) { return []; }
  }
};

window.db_getEpisode = async function (epId) {
  try {
    const snap = await getDoc(uDoc('episodes', epId));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  } catch (e) { return null; }
};

window.db_deleteEpisode = async function (epId) {
  try { await deleteDoc(uDoc('episodes', epId)); }
  catch (e) { console.warn('[db] deleteEpisode fail', e); }
};

// analysis.js calls: db_deleteByTitle(title) — delete ALL episodes with that title
window.db_deleteByTitle = async function (title) {
  try {
    const eps = await window.db_getEpisodes();
    const toDelete = eps.filter(e => (e.title || 'Untitled') === title);
    await Promise.all(toDelete.map(e => deleteDoc(uDoc('episodes', e.id))));
  } catch (e) { console.warn('[db] deleteByTitle fail', e); }
};

// ── USED IDEAS (dedup) ───────────────────────────
window.db_getUsedIdeas = async function () {
  try {
    const snap = await getDoc(uDoc('meta', 'usedIdeas'));
    return snap.exists() ? (snap.data().list || []) : [];
  } catch (e) { return []; }
};

window.db_saveUsedIdeas = async function (list) {
  try { await setDoc(uDoc('meta', 'usedIdeas'), { list }, { merge: true }); }
  catch (e) { console.warn('[db] saveUsedIdeas fail', e); }
};

// ── SEASONS ──────────────────────────────────────
window.db_getSeasons = async function () {
  try {
    const snap = await getDocs(uCol('seasons'));
    return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } catch (e) { return []; }
};

window.db_saveSeason = async function (seasonId, data) {
  try { await setDoc(uDoc('seasons', seasonId), data, { merge: true }); }
  catch (e) { console.warn('[db] saveSeason fail', e); }
};

window.db_getSeason = async function (seasonId) {
  try {
    const snap = await getDoc(uDoc('seasons', seasonId));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
};
