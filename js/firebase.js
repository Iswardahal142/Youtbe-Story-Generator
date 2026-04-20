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

// ── ALLOWED EMAILS (Whitelist) ──────────────────────
// Jo emails is list mein hain SIRF woh login kar sakte hain.
// Khali array = koi bhi Google account se login kar sakta hai.
// Example: ["yourname@gmail.com", "friend@gmail.com"]
const ALLOWED_EMAILS = [];

// ── Firebase SDK Imports ────────────────────────────
import { initializeApp }            from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, deleteDoc,
  collection, getDocs,
  query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Init ────────────────────────────────────────────
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);
const provider    = new GoogleAuthProvider();

let currentUser      = null;
let _readyCallbacks  = [];
let _dbReady         = false;

// ── Auth State Listener ─────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Whitelist check
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(user.email)) {
      await signOut(auth);
      _showAuthScreen();
      _showAuthError("❌ Is email ko access nahi hai. Admin se sampark karo.");
      return;
    }

    currentUser = user;
    _renderUserHeader(user);
    _hideAuthScreen();

    // Signal: DB ready
    _dbReady = true;
    _readyCallbacks.forEach(cb => cb());
    _readyCallbacks = [];

  } else {
    currentUser = null;
    _showAuthScreen();
  }
});

// ── Google Login ────────────────────────────────────
window.googleLogin = async function () {
  const btn = document.getElementById('googleLoginBtn');
  const errEl = document.getElementById('authError');
  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Login ho raha hai...'; }

  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged will handle the rest
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.3 30.2 0 24 0 14.7 0 6.7 5.4 2.7 13.3l7.8 6c1.8-5.4 6.8-9.8 13.5-9.8z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.3-4.7 6.9l7.3 5.7c4.3-4 6.8-9.9 7.2-16.6z"/>
          <path fill="#FBBC05" d="M10.5 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.8-6.1z"/>
          <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.6 0-12.2-4.5-14.2-10.4l-7.8 6.1C6.7 42.6 14.7 48 24 48z"/>
        </svg>
        🔐 Google se Login Karo`;
    }

    let msg = "Login fail ho gaya. Dobara try karo.";
    if (err.code === 'auth/popup-closed-by-user')   msg = "Popup band kar diya. Dobara try karo.";
    if (err.code === 'auth/network-request-failed')  msg = "Internet check karo aur dobara try karo.";
    if (err.code === 'auth/popup-blocked')           msg = "Popup block ho gaya — browser mein popup allow karo.";
    _showAuthError("⚠️ " + msg);
  }
};

// ── Logout ──────────────────────────────────────────
window.logoutUser = async function () {
  if (!confirm("Logout karna chahte ho?")) return;
  await signOut(auth);
};

// ── Internal UI Helpers ─────────────────────────────
function _showAuthScreen() {
  const auth = document.getElementById('authScreen');
  const app  = document.getElementById('appContent');
  if (auth) auth.style.display = 'flex';
  if (app)  app.style.display  = 'none';
}

function _hideAuthScreen() {
  const authEl = document.getElementById('authScreen');
  const appEl  = document.getElementById('appContent');
  if (authEl) authEl.style.display = 'none';
  if (appEl)  appEl.style.display  = '';
  // Trigger main app init
  if (window._appLoad) window._appLoad();
}

function _renderUserHeader(user) {
  const avatar = document.getElementById('userAvatar');
  const name   = document.getElementById('userName');
  if (avatar && user.photoURL) avatar.src = user.photoURL;
  if (name)   name.textContent = user.displayName || user.email;
}

function _showAuthError(msg) {
  const el = document.getElementById('authError');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── DB Ready Callback ───────────────────────────────
window.db_onReady = function (cb) {
  if (_dbReady) cb();
  else _readyCallbacks.push(cb);
};

// ── Firestore Helpers ───────────────────────────────
function _userDoc(...path) {
  if (!currentUser) throw new Error('Not logged in');
  return doc(db, 'users', currentUser.uid, ...path);
}
function _userCol(...path) {
  if (!currentUser) throw new Error('Not logged in');
  return collection(db, 'users', currentUser.uid, ...path);
}

// ── State ───────────────────────────────────────────
window.db_saveState = async function (stateObj) {
  try { await setDoc(_userDoc('meta', 'state'), stateObj, { merge: true }); }
  catch (e) { console.warn('[db] state save fail', e); }
};

window.db_loadState = async function () {
  try {
    const snap = await getDoc(_userDoc('meta', 'state'));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
};

// ── Episodes ────────────────────────────────────────
window.db_getEpisodes = async function () {
  try {
    const q    = query(_userCol('episodes'), orderBy('savedAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
};

window.db_saveEpisode = async function (epId, epData) {
  try { await setDoc(_userDoc('episodes', epId), epData, { merge: true }); }
  catch (e) { console.warn('[db] ep save fail', e); }
};

window.db_getEpisode = async function (epId) {
  try {
    const snap = await getDoc(_userDoc('episodes', epId));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
};

window.db_deleteEpisode = async function (epId) {
  try { await deleteDoc(_userDoc('episodes', epId)); }
  catch (e) { console.warn('[db] ep delete fail', e); }
};

// ── Used Ideas (dedup) ──────────────────────────────
window.db_getUsedIdeas = async function () {
  try {
    const snap = await getDoc(_userDoc('meta', 'usedIdeas'));
    return snap.exists() ? (snap.data().list || []) : [];
  } catch (e) { return []; }
};

window.db_saveUsedIdeas = async function (list) {
  try { await setDoc(_userDoc('meta', 'usedIdeas'), { list }, { merge: true }); }
  catch (e) { console.warn('[db] usedIdeas save fail', e); }
};

// ── Seasons ─────────────────────────────────────────
window.db_getSeasons = async function () {
  try {
    const snap = await getDocs(_userCol('seasons'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
};

window.db_saveSeason = async function (seasonId, data) {
  try { await setDoc(_userDoc('seasons', seasonId), data, { merge: true }); }
  catch (e) { console.warn('[db] season save fail', e); }
};

window.db_getSeason = async function (seasonId) {
  try {
    const snap = await getDoc(_userDoc('seasons', seasonId));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
};
