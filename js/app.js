// ══ TOAST ══
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ══ BOTTOM NAV ══
function bnavSetActive(tab) {
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  const map = { generate: 'bnavGenerate', stories: 'bnavStories', youtube: 'bnavYoutube', more: 'bnavMore' };
  const el = document.getElementById(map[tab]);
  if (el) el.classList.add('active');
}

function bnavGo(tab) {
  bnavSetActive(tab);
  if (tab === 'generate') { goToSetup(); }
  else if (tab === 'stories') { goToAnalysis(); setTimeout(() => switchTab('el'), 150); }
  else if (tab === 'youtube') { goToYtExport(); }
  else if (tab === 'more') { toast('🔧 Jald aayega...'); }
}

// Auto-highlight correct tab when screens change via other buttons
const _origShowScreen = window.showScreen;
document.addEventListener('DOMContentLoaded', () => {
  // Patch showScreen after all scripts load
  const _patch = () => {
    const orig = window.showScreen;
    if (!orig) return setTimeout(_patch, 100);
    window.showScreen = function(id) {
      orig(id);
      if (id === 'screenSetup')    bnavSetActive('generate');
      else if (id === 'screenStory') bnavSetActive('generate');
      else if (id === 'screenAnalysis') { /* keep whichever tab triggered it */ }
      else if (id === 'screenThumb') { /* no specific tab */ }
    };
  };
  _patch();
});

// ══ INIT ══
// Firebase auth ready hone ke baad call hoga (firebase.js triggers this)
async function _appLoad() {
  await load();
  restoreSetupForm();
  renderSetupEpList();
}
window._appLoad = _appLoad;

// ══ THUMBNAIL / IMAGE MODAL ══
function copyThumbPrompt(btn, text) {
  navigator.clipboard.writeText(text).then(function () {
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.style.borderColor = '#44bb66';
    btn.style.color = '#44bb66';
    setTimeout(function () {
      btn.innerHTML = orig;
      btn.style.borderColor = '#aa66ff';
      btn.style.color = '#aa66ff';
    }, 2000);
  });
}

// ── Image Generator Modal ──────────────────────────
// "Image Banao" button scene cards mein hota hai
function openImgModal(btn) {
  const prompt = btn.dataset.prompt.replace(/&quot;/g, '"');
  _launchImgModal(prompt);
}

// Thumbnail screen se open
function openThumbModal(text) {
  _launchImgModal(text);
}

function _launchImgModal(prompt) {
  const modal  = document.getElementById('imgGenModal');
  const iframe = document.getElementById('imgGenIframe');
  if (!modal || !iframe) { console.warn('imgGenModal not found'); return; }
  // Ai/index.html URL param se prompt auto-fill karta hai
  iframe.src = 'Ai/index.html?prompt=' + encodeURIComponent(prompt);
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeImgModal() {
  const modal  = document.getElementById('imgGenModal');
  const iframe = document.getElementById('imgGenIframe');
  if (modal)  modal.classList.remove('open');
  if (iframe) iframe.src = '';
  document.body.style.overflow = '';
}

// Modal background tap se band ho
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('imgGenModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeImgModal();
    });
  }
});

// ── Scene prompt copy button ───────────────────────
function copyScenePrompt(btn) {
  const text = btn.dataset.prompt.replace(/&quot;/g, '"');
  navigator.clipboard.writeText(text).then(function () {
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.style.borderColor = '#44bb66';
    btn.style.color = '#44bb66';
    setTimeout(function () {
      btn.innerHTML = orig;
      btn.style.borderColor = '#440000';
      btn.style.color = '#cc4444';
    }, 2000);
  });
}
