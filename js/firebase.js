// ══ FIREBASE CONFIG ══
// 🔴 APNA CONFIG YAHAN BHARO — firebase console → project settings → your apps
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4G3cBS6fTmi7PXRrCbQPIkEbr-bh_470",
  authDomain: "fir-c929f.firebaseapp.com",
  projectId: "fir-c929f",
  storageBucket: "fir-c929f.firebasestorage.app",
  messagingSenderId: "82713990557",
  appId: "1:82713990557:web:d4586900ad445cb8a2cb74",
  measurementId: "G-SYRNS1D7BJ"
};

// ══ INIT ══
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// Current user ID (anonymous auth)
let currentUID = null;

// App ko Firebase ready hone ka wait karwao
let firebaseReady = false;
let firebaseReadyCallbacks = [];

function onFirebaseReady(cb) {
  if (firebaseReady) { cb(); return; }
  firebaseReadyCallbacks.push(cb);
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUID = user.uid;
  } else {
    // Anonymous sign-in — bina login ke unique ID milegi
    try {
      const cred = await signInAnonymously(auth);
      currentUID = cred.user.uid;
    } catch (e) {
      console.error('Firebase Auth error:', e);
      // Fallback to localStorage if Firebase fails
      currentUID = null;
    }
  }
  firebaseReady = true;
  firebaseReadyCallbacks.forEach(cb => cb());
  firebaseReadyCallbacks = [];
});

// ══ HELPERS ══
function userDoc(path) {
  // e.g. userDoc('state') → users/{uid}/state
  // e.g. userDoc('episodes/ep123') → users/{uid}/episodes/ep123
  const parts = path.split('/');
  if (parts.length === 1) {
    return doc(db, 'users', currentUID, parts[0], 'data');
  }
  return doc(db, 'users', currentUID, parts[0], parts[1]);
}

function userCol(colName) {
  return collection(db, 'users', currentUID, colName);
}

// ══ STATE FUNCTIONS ══
async function dbSaveState(stateObj) {
  if (!currentUID) { lsSaveState(stateObj); return; }
  try {
    await setDoc(userDoc('state'), stateObj);
  } catch (e) {
    console.warn('Firestore save failed, using localStorage:', e);
    lsSaveState(stateObj);
  }
}

async function dbLoadState() {
  if (!currentUID) return lsLoadState();
  try {
    const snap = await getDoc(userDoc('state'));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('Firestore load failed, using localStorage:', e);
    return lsLoadState();
  }
}

// ══ EPISODE FUNCTIONS ══
async function dbSaveEpisode(ep) {
  if (!currentUID) { lsSaveEpisode(ep); return; }
  try {
    await setDoc(doc(db, 'users', currentUID, 'episodes', ep.id), ep);
  } catch (e) {
    console.warn('Firestore episode save failed:', e);
    lsSaveEpisode(ep);
  }
}

async function dbGetEpisodes() {
  if (!currentUID) return lsGetEpisodes();
  try {
    const snap = await getDocs(userCol('episodes'));
    const eps = [];
    snap.forEach(d => eps.push(d.data()));
    // Sort by savedAt desc
    eps.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    return eps;
  } catch (e) {
    console.warn('Firestore episodes load failed:', e);
    return lsGetEpisodes();
  }
}

async function dbDeleteEpisode(id) {
  if (!currentUID) { lsDeleteEpisode(id); return; }
  try {
    await deleteDoc(doc(db, 'users', currentUID, 'episodes', id));
  } catch (e) {
    console.warn('Firestore delete failed:', e);
    lsDeleteEpisode(id);
  }
}

async function dbDeleteEpisodesByTitle(title) {
  if (!currentUID) { lsDeleteEpisodesByTitle(title); return; }
  try {
    const snap = await getDocs(userCol('episodes'));
    const toDelete = [];
    snap.forEach(d => { if (d.data().title === title) toDelete.push(d.id); });
    await Promise.all(toDelete.map(id => deleteDoc(doc(db, 'users', currentUID, 'episodes', id))));
  } catch (e) {
    console.warn('Firestore bulk delete failed:', e);
    lsDeleteEpisodesByTitle(title);
  }
}

// ══ USED IDEAS ══
async function dbSaveUsedIdeas(ideas) {
  if (!currentUID) { lsSaveUsedIdeas(ideas); return; }
  try {
    await setDoc(userDoc('usedIdeas'), { list: ideas });
  } catch (e) { lsSaveUsedIdeas(ideas); }
}

async function dbGetUsedIdeas() {
  if (!currentUID) return lsGetUsedIdeas();
  try {
    const snap = await getDoc(userDoc('usedIdeas'));
    return snap.exists() ? (snap.data().list || []) : [];
  } catch (e) { return lsGetUsedIdeas(); }
}

// ══ LOCALSTORAGE FALLBACKS ══
// Agar Firebase fail ho toh localStorage backup kaam karega
const SK = 'kaali_raat_v2';
function lsSaveState(s)    { try { localStorage.setItem(SK+'_state', JSON.stringify(s)); } catch {} }
function lsLoadState()     { try { return JSON.parse(localStorage.getItem(SK+'_state')); } catch { return null; } }
function lsGetEpisodes()   { try { return JSON.parse(localStorage.getItem(SK+'_eps')) || []; } catch { return []; } }
function lsSaveEpisode(ep) {
  try {
    const eps = lsGetEpisodes();
    const idx = eps.findIndex(e => e.id === ep.id);
    if (idx !== -1) eps[idx] = ep; else eps.push(ep);
    localStorage.setItem(SK+'_eps', JSON.stringify(eps));
  } catch {}
}
function lsDeleteEpisode(id) {
  try {
    const eps = lsGetEpisodes().filter(e => e.id !== id);
    localStorage.setItem(SK+'_eps', JSON.stringify(eps));
  } catch {}
}
function lsDeleteEpisodesByTitle(title) {
  try {
    const eps = lsGetEpisodes().filter(e => e.title !== title);
    localStorage.setItem(SK+'_eps', JSON.stringify(eps));
  } catch {}
}
function lsSaveUsedIdeas(ideas) { try { localStorage.setItem(SK+'_usedIdeas', JSON.stringify(ideas)); } catch {} }
function lsGetUsedIdeas()       { try { return JSON.parse(localStorage.getItem(SK+'_usedIdeas')) || []; } catch { return []; } }

// ══ EXPORTS — global functions jo baaki JS files use karengi ══
window.db_onReady        = onFirebaseReady;
window.db_saveState      = dbSaveState;
window.db_loadState      = dbLoadState;
window.db_saveEpisode    = dbSaveEpisode;
window.db_getEpisodes    = dbGetEpisodes;
window.db_deleteEpisode  = dbDeleteEpisode;
window.db_deleteByTitle  = dbDeleteEpisodesByTitle;
window.db_saveUsedIdeas  = dbSaveUsedIdeas;
window.db_getUsedIdeas   = dbGetUsedIdeas;
