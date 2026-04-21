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

  // Group by BASE title (pehla part before |)
  const groups = {};
  eps.slice().reverse().forEach(ep => {
    const baseTitle = (ep.title || 'Untitled').split(' | ')[0].trim();
    if (!groups[baseTitle]) groups[baseTitle] = [];
    groups[baseTitle].push(ep);
  });

  const cards = Object.entries(groups).map(([baseTitle, epList]) => {
    const seasonMap = {};
    epList.forEach(ep => {
      const s = ep.season || 'SEASON 1';
      if (!seasonMap[s]) seasonMap[s] = [];
      seasonMap[s].push(ep);
    });
    const totalSeasons = Object.keys(seasonMap).length;
    const totalEps     = epList.length;
    const latest       = epList[0];
    const words        = epList.reduce((s, e) => s + (e.wordCount || 0), 0);
    const dateStr      = latest.savedAt ? new Date(latest.savedAt).toLocaleDateString('hi-IN') : '';
    const allDone      = epList.every(e => e.ended);
    const cardId       = 'sc_' + Math.random().toString(36).slice(2,8);

    let seasonListHtml = '';
    Object.entries(seasonMap).forEach(([season, sEps]) => {
      const sorted = sEps.slice().sort((a,b) => (a.epNum||'').localeCompare(b.epNum||''));
      seasonListHtml += '<div style="margin-bottom:8px;">';
      seasonListHtml += '<div style="font-size:9px;letter-spacing:2px;color:#660000;text-transform:uppercase;margin-bottom:4px;">' + season + '</div>';
      sorted.forEach(ep => {
        const epYtTitle = (ep.title || '').split(' | ')[1] || (ep.title || '');
        seasonListHtml += '<div class="ep-row" onclick="loadEpisode(\'' + ep.id + '\'); bnavSetActive(\'generate\');" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid #1a0000;margin-bottom:4px;cursor:pointer;">';
        seasonListHtml += '<span style="font-size:10px;color:#880000;font-weight:700;flex-shrink:0;">' + (ep.epNum || 'EP 01') + '</span>';
        seasonListHtml += '<span style="font-size:11px;color:#bbb;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + epYtTitle + '</span>';
        seasonListHtml += '<span style="font-size:9px;color:' + (ep.ended ? '#44bb66' : '#555') + ';">' + (ep.ended ? '✓' : '…') + '</span>';
        seasonListHtml += '</div>';
      });
      seasonListHtml += '</div>';
    });

    return '<div class="story-card" id="' + cardId + '">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;" onclick="_toggleStoryCard(\'' + cardId + '\')">' +
        '<div style="flex:1;">' +
          '<div class="story-card-title">' + baseTitle + '</div>' +
          '<div class="story-card-meta" style="margin-top:4px;">' +
            '<span class="scene-tag">' + totalSeasons + ' Season' + (totalSeasons > 1 ? 's' : '') + '</span>' +
            '<span class="scene-tag">' + totalEps + ' Ep' + (totalEps > 1 ? 's' : '') + '</span>' +
            '<span class="scene-tag" style="color:' + (allDone ? '#44bb66' : '#cc8822') + ';border-color:' + (allDone ? '#1a4a22' : '#3a2200') + ';">' + (allDone ? '✅ Complete' : '🔄 Ongoing') + '</span>' +
          '</div>' +
          '<div class="story-card-words" style="margin-top:4px;">' + words.toLocaleString() + ' words · ' + dateStr + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">' +
          '<button class="ep-row-del" onclick="deleteStory(event,\'' + baseTitle + '\'); renderMyStories();">🗑</button>' +
          '<span style="font-size:11px;color:#444;" id="' + cardId + '_arrow">▼</span>' +
        '</div>' +
      '</div>' +
      '<div id="' + cardId + '_list" style="display:none;margin-top:10px;border-top:1px solid #1a0000;padding-top:10px;">' +
        seasonListHtml +
      '</div>' +
    '</div>';
  });

  container.innerHTML = cards.join('');

  if (window.ytMatchMyStories) {
    window.ytMatchMyStories().catch(() => {});
  }
}

function _toggleStoryCard(cardId) {
  const list  = document.getElementById(cardId + '_list');
  const arrow = document.getElementById(cardId + '_arrow');
  if (!list) return;
  const open = list.style.display !== 'none';
  list.style.display  = open ? 'none' : 'block';
  if (arrow) arrow.textContent = open ? '▼' : '▲';
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
    showScreen('screenYoutube');
    renderYtChecklist();
    if (window.updateYtStatusBadge) updateYtStatusBadge();
    if (window._ytRestoreSavedOutputs) _ytRestoreSavedOutputs();
    setTimeout(function() {
      if (window.ytTabComparison) window.ytTabComparison().catch(function(){});
    }, 300);
  } else if (tab === 'profile') {
    showScreen('screenProfile');
  }
}

// ══ showScreen PATCH — DOMContentLoaded hataaya, defer scripts mein zaroorat nahi ══
(function _patchShowScreen() {
  const orig = window.showScreen;
  if (!orig) return setTimeout(_patchShowScreen, 50);
  window.showScreen = function(id) {
    orig(id);
    if (id === 'screenSetup' || id === 'screenStory') bnavSetActive('generate');
    else if (id === 'screenMyStories') bnavSetActive('stories');
    else if (id === 'screenYoutube')   bnavSetActive('youtube');
    else if (id === 'screenProfile')   bnavSetActive('profile');
  };
})();

// ══ INIT ══
// Firebase auth ready hone ke baad call hoga (firebase.js triggers this)
async function _appLoad() {
  await load();
  // Channel name window pe set karo taaki restoreSetupForm ko mile
  if (state.channel && !window.ytFetchedChannelName) {
    window.ytFetchedChannelName = state.channel;
  }
  restoreSetupForm();
  renderSetupEpList();
  // Show YT status dot on load
  setTimeout(function() {
    if (window.updateYtStatusBadge) updateYtStatusBadge();
  }, 500);
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
