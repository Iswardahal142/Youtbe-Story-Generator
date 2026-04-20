// ══ TOAST ══
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ══ SIDE DRAWER ══
function openDrawer() {
  document.getElementById('sideDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('sideDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
// Swipe-to-open drawer
(function() {
  let startX = 0, startY = 0;
  document.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (startX < 24 && dx > 60 && dy < 80) openDrawer();
  }, { passive: true });
})();

// ══ MY STORIES ══
async function renderMyStories() {
  const container = document.getElementById('myStoriesContent');
  if (!container) return;
  container.innerHTML = '<div class="mystories-empty"><span class="empty-icon">⏳</span>Loading...</div>';

  const eps = await window.db_getEpisodes();
  if (!eps || !eps.length) {
    container.innerHTML = '<div class="mystories-empty"><span class="empty-icon">📭</span>Koi story save nahi hui abhi.<br><span style="font-size:12px;color:#333;">Generate tab se pehli story likho!</span></div>';
    return;
  }

  // Group by title
  const groups = {};
  eps.slice().reverse().forEach(ep => {
    const key = ep.title || 'Untitled';
    if (!groups[key]) groups[key] = [];
    groups[key].push(ep);
  });

  container.innerHTML = Object.entries(groups).map(([title, epList]) => {
    const seasons   = [...new Set(epList.map(e => e.season))].join(', ');
    const totalEps  = epList.length;
    const latest    = epList[0];
    const allDone   = epList.every(e => e.ended);
    const words     = epList.reduce((s, e) => s + (e.wordCount || 0), 0);
    const dateStr   = latest.savedAt ? new Date(latest.savedAt).toLocaleDateString('hi-IN') : '';
    return `
      <div class="story-card" onclick="loadEpisode('${latest.id}'); bnavSetActive('generate');">
        <div class="story-card-title">${title}</div>
        <div class="story-card-meta">
          <span class="scene-tag">${seasons}</span>
          <span class="scene-tag">${totalEps} ep${totalEps > 1 ? 's' : ''}</span>
          <span class="scene-tag" style="color:${allDone ? '#44bb66' : '#cc8822'};border-color:${allDone ? '#1a4a22' : '#3a2200'};">${allDone ? '✅ Complete' : '🔄 Ongoing'}</span>
        </div>
        <div class="story-card-words">${words.toLocaleString()} words · ${dateStr}</div>
        <button class="ep-row-del" onclick="deleteStory(event,'${title}'); renderMyStories();">🗑</button>
      </div>
    `;
  }).join('');
}

// ══ BOTTOM NAV ══
function bnavSetActive(tab) {
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  const map = {
    generate : 'bnavGenerate',
    stories  : 'bnavStories',
    youtube  : 'bnavYoutube',
    profile  : 'bnavProfile'
  };
  const el = document.getElementById(map[tab]);
  if (el) el.classList.add('active');
}

function bnavGo(tab) {
  bnavSetActive(tab);
  if (tab === 'generate') {
    goToSetup();
  } else if (tab === 'stories') {
    showScreen('screenMyStories');
    renderMyStories();
  } else if (tab === 'youtube') {
    goToYtExport();
  } else if (tab === 'profile') {
    showScreen('screenProfile');
  }
}

// Auto-highlight correct tab when screens change via other buttons
document.addEventListener('DOMContentLoaded', () => {
  const _patch = () => {
    const orig = window.showScreen;
    if (!orig) return setTimeout(_patch, 100);
    window.showScreen = function(id) {
      orig(id);
      if (id === 'screenSetup' || id === 'screenStory') bnavSetActive('generate');
      else if (id === 'screenMyStories') bnavSetActive('stories');
      else if (id === 'screenProfile')   bnavSetActive('profile');
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
