// ══ TOAST ══
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ══ INIT ══
// Firebase auth ready hone ke baad call hoga
async function _appLoad() {
  await load();
  restoreSetupForm();
  renderSetupEpList();
}
window._appLoad = _appLoad;

window.addEventListener('load', () => {
  window.db_onReady(async () => {
    // Agar user already logged in hai (page refresh) toh seedha load karo
    // renderAuthUI firebase.js mein handle karega — yahan wait karo
    setTimeout(async () => {
      const appContent = document.getElementById('appContent');
      if (appContent && appContent.style.display !== 'none') {
        await _appLoad();
      }
    }, 800);
  });
});

// ══ THUMBNAIL COPY / MODAL ══
function copyThumbPrompt(btn, text) {
  navigator.clipboard.writeText(text).then(function() {
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.style.borderColor = '#44bb66';
    btn.style.color = '#44bb66';
    setTimeout(function() { btn.innerHTML = orig; btn.style.borderColor = '#aa66ff'; btn.style.color = '#aa66ff'; }, 2000);
  });
}

function openThumbModal(text) {
  const iframe = document.getElementById('imgGenIframe');
  iframe.src = '/Ai/index.html?prompt=' + encodeURIComponent(text);
  document.getElementById('imgGenModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

// ══ IMAGE GENERATOR MODAL ══
function openImgModal(btn) {
  const prompt = btn.dataset.prompt.replace(/&quot;/g, '"');
  const iframe = document.getElementById('imgGenIframe');
  iframe.src = '/Ai/index.html?prompt=' + encodeURIComponent(prompt);
  document.getElementById('imgGenModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeImgModal() {
  document.getElementById('imgGenIframe').src = '';
  document.getElementById('imgGenModal').style.display = 'none';
  document.body.style.overflow = '';
}

function copyScenePrompt(btn) {
  const text = btn.dataset.prompt.replace(/&quot;/g, '"');
  navigator.clipboard.writeText(text).then(function() {
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.style.borderColor = '#44bb66';
    btn.style.color = '#44bb66';
    setTimeout(function() {
      btn.innerHTML = orig;
      btn.style.borderColor = '#440000';
      btn.style.color = '#cc4444';
    }, 2000);
  });
}

// Modal background tap se band ho
const _modal = document.getElementById('imgGenModal');
if (_modal) _modal.addEventListener('click', function(e) {
  if (e.target === this) closeImgModal();
});
