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

// ══ MY STORIES — 3-level navigation ══

// ── YT upload check helper ──
async function _isEpisodeUploaded(ep) {
  try {
    const data = await window._fetchYtVideos();
    const { videos } = data;
    if (!videos || !videos.length) return false;
    const matchTitle = ep.ytTitle || (ep.title || '').split(' | ')[1] || ep.title || '';
    let best = 0;
    videos.forEach(v => {
      const s = window._ytMatchScore(matchTitle, v.title, v.description);
      if (s > best) best = s;
    });
    return best >= 40;
  } catch { return false; }
}

// ── LEVEL 1: My Stories ──
async function renderMyStories() {
  const container = document.getElementById('myStoriesContent');
  if (!container) return;
  container.innerHTML = '<div class="mystories-empty"><span class="empty-icon">⏳</span>Loading...</div>';

  const eps = await window.db_getEpisodes();
  if (!eps || !eps.length) {
    container.innerHTML = '<div class="mystories-empty"><span class="empty-icon">📭</span>Koi story save nahi hui abhi.<br><span style="font-size:12px;color:#333;">Generate tab se pehli story likho!</span></div>';
    return;
  }

  const groups = {};
  eps.slice().reverse().forEach(ep => {
    const base = (ep.title || 'Untitled').split(' | ')[0].trim();
    if (!groups[base]) groups[base] = [];
    groups[base].push(ep);
  });

  const html = Object.entries(groups).map(([baseTitle, epList]) => {
    const totalEps     = epList.length;
    const totalSeasons = new Set(epList.map(e => e.season || 'SEASON 1')).size;
    const words        = epList.reduce((s, e) => s + (e.wordCount || 0), 0);
    const latest       = epList[0];
    const dateStr      = latest.savedAt ? new Date(latest.savedAt).toLocaleDateString('hi-IN') : '';
    const safeTitle    = baseTitle.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    return '<div class="story-card" data-story-title="' + baseTitle.replace(/"/g,'&quot;') + '" onclick="openSeasonsScreen(\'' + safeTitle + '\')" style="cursor:pointer;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
        '<div style="flex:1;">' +
          '<div class="story-card-title">' + baseTitle + '</div>' +
          '<div class="story-card-meta" style="margin-top:5px;">' +
            '<span class="scene-tag">' + totalSeasons + ' Season' + (totalSeasons > 1 ? 's' : '') + '</span>' +
            '<span class="scene-tag">' + totalEps + ' Ep' + (totalEps > 1 ? 's' : '') + '</span>' +
          '</div>' +
          '<div class="story-card-words" style="margin-top:3px;">' + words.toLocaleString() + ' words · ' + dateStr + '</div>' +
          '<div class="yt-views-badge" style="margin-top:5px;min-height:16px;"></div>' +
        '</div>' +
        '<span style="font-size:22px;color:#444;">›</span>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = '<div class="ep-list-body">' + html + '</div>';
  if (window.ytMatchMyStories) window.ytMatchMyStories().catch(() => {});
}

// ── LEVEL 2: Seasons screen ──
async function openSeasonsScreen(baseTitle) {
  document.getElementById('seasonsScreenTitle').textContent = baseTitle;
  const container = document.getElementById('seasonsContent');
  container.innerHTML = '<div class="mystories-empty"><span class="empty-icon">⏳</span>Loading...</div>';
  showScreen('screenSeasons');

  const eps    = await window.db_getEpisodes();
  const epList = eps.filter(e => (e.title || 'Untitled').split(' | ')[0].trim() === baseTitle);

  const seasonMap = {};
  epList.forEach(ep => {
    const s = ep.season || 'SEASON 1';
    if (!seasonMap[s]) seasonMap[s] = [];
    seasonMap[s].push(ep);
  });

  const safeBase = baseTitle.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const html = Object.entries(seasonMap).map(([season, sEps]) => {
    const totalEps   = sEps.length;
    const allDone    = sEps.every(e => e.ended);
    const safeSeason = season.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    return '<div class="story-card" style="cursor:pointer;" onclick="openEpisodesScreen(\'' + safeBase + '\',\'' + safeSeason + '\')">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
        '<div style="flex:1;">' +
          '<div style="font-size:9px;letter-spacing:2px;color:#880000;text-transform:uppercase;font-weight:700;margin-bottom:5px;">📂 ' + season + '</div>' +
          '<div class="story-card-meta">' +
            '<span class="scene-tag">' + totalEps + ' Episode' + (totalEps > 1 ? 's' : '') + '</span>' +
            '<span class="scene-tag" style="color:' + (allDone ? '#44bb66' : '#cc8822') + ';border-color:' + (allDone ? '#1a4a22' : '#3a2200') + ';">' + (allDone ? '✅ Complete' : '🔄 Ongoing') + '</span>' +
          '</div>' +
          '<div class="season-yt-badge" data-season="' + season.replace(/"/g,'&quot;') + '" style="margin-top:5px;min-height:16px;"></div>' +
        '</div>' +
        '<span style="font-size:22px;color:#444;">›</span>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = '<div class="ep-list-body">' + html + '</div>';
  _fillSeasonYtBadges(epList).catch(() => {});
}

async function _fillSeasonYtBadges(epList) {
  let data;
  try { data = await window._fetchYtVideos(); } catch { return; }
  const { videos } = data || {};
  if (!videos || !videos.length) return;

  document.querySelectorAll('.season-yt-badge').forEach(badge => {
    const season = badge.dataset.season;
    const sEps   = epList.filter(e => (e.season || 'SEASON 1') === season);
    let totalViews = 0, anyUploaded = false;

    sEps.forEach(ep => {
      const matchTitle = ep.ytTitle || (ep.title || '').split(' | ')[1] || ep.title || '';
      let best = 0, bestVid = null;
      videos.forEach(v => {
        const s = window._ytMatchScore(matchTitle, v.title, v.description);
        if (s > best) { best = s; bestVid = v; }
      });
      if (bestVid && best >= 40) { totalViews += bestVid.viewCount || 0; anyUploaded = true; }
    });

    if (anyUploaded) {
      badge.innerHTML = '<span style="font-size:10px;color:#ff4444;font-weight:700;">▶ ' + window._ytFormatViews(totalViews) + ' total views</span>';
    } else {
      badge.innerHTML = '<span style="font-size:10px;color:#553333;">❌ Not Uploaded</span>';
    }
  });
}

// ── LEVEL 3: Episodes screen ──
async function openEpisodesScreen(baseTitle, season) {
  const eps  = await window.db_getEpisodes();
  const sEps = eps
    .filter(e => (e.title || 'Untitled').split(' | ')[0].trim() === baseTitle && (e.season || 'SEASON 1') === season)
    .sort((a, b) => (a.epNum || '').localeCompare(b.epNum || ''));

  const ytHeader = sEps.find(e => e.ytTitle) ? sEps.find(e => e.ytTitle).ytTitle : season;
  document.getElementById('episodesScreenTitle').textContent = ytHeader;
  document.getElementById('episodesBackBtn').onclick = function() { openSeasonsScreen(baseTitle); };

  const container = document.getElementById('episodesContent');
  container.innerHTML = '<div class="mystories-empty"><span class="empty-icon">⏳</span>Loading...</div>';
  showScreen('screenEpisodes');

  const safeBase   = baseTitle.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safeSeason = season.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const rows = sEps.map(ep => {
    const epYtTitle = (ep.title || '').split(' | ')[1] || ep.title || 'Untitled';
    return '<div class="ms-ep-load-row" data-ep-id="' + ep.id + '" ' +
        'style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #0f0000;cursor:pointer;">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">' +
          '<span style="font-size:10px;color:#880000;font-weight:700;">' + (ep.epNum || 'EP 01') + '</span>' +
          '<span style="font-size:9px;color:' + (ep.ended ? '#44bb66' : '#cc8822') + ';">' + (ep.ended ? '✅ Done' : '🔄 Ongoing') + '</span>' +
        '</div>' +
        '<div style="font-size:13px;color:#ddd;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + epYtTitle + '</div>' +
        '<div class="ms-ep-yt-status" data-ep-id="' + ep.id + '" style="margin-top:4px;">' +
          '<span style="font-size:10px;color:#444;">⏳ Checking YouTube...</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">' +
        '<button class="ms-ep-del-btn" data-ep-id="' + ep.id + '" data-base="' + safeBase + '" data-season="' + safeSeason + '" ' +
          'style="background:transparent;border:1px solid #2a0000;color:#553333;font-size:11px;padding:4px 8px;border-radius:6px;cursor:pointer;">🗑</button>' +
        '<span style="font-size:18px;color:#444;">›</span>' +
      '</div>' +
    '</div>';
  }).join('');

  container.innerHTML = '<div style="padding-bottom:80px;">' + rows + '</div>';
  _fillEpisodeYtBadges(sEps).catch(() => {});

  // Event delegation
  container.querySelectorAll('.ms-ep-load-row').forEach(row => {
    row.addEventListener('click', async function() {
      const id = this.dataset.epId;
      if (!id) return;
      await loadEpisode(id);
      bnavSetActive('generate');
    });
  });
  container.querySelectorAll('.ms-ep-del-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      _deleteEpisode(this.dataset.epId, this.dataset.base, this.dataset.season);
    });
  });
}

async function _fillEpisodeYtBadges(sEps) {
  let data;
  try { data = await window._fetchYtVideos(); } catch {
    document.querySelectorAll('.ms-ep-yt-status').forEach(n => {
      n.innerHTML = '<span style="font-size:10px;color:#553333;font-weight:600;">❌ Not Uploaded</span>';
    });
    return;
  }
  const { videos } = data || {};
  if (!videos || !videos.length) return;

  const sorted = [...videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const rankMap = {};
  sorted.forEach((v, i) => { rankMap[v.videoId] = i + 1; });

  document.querySelectorAll('.ms-ep-yt-status[data-ep-id]').forEach(node => {
    const ep = sEps.find(e => e.id === node.dataset.epId);
    if (!ep) return;

    const matchTitle = ep.ytTitle || (ep.title || '').split(' | ')[1] || ep.title || '';
    let best = 0, bestVid = null;
    videos.forEach(v => {
      const s = window._ytMatchScore(matchTitle, v.title, v.description);
      if (s > best) { best = s; bestVid = v; }
    });

    const delBtn = document.getElementById('del_' + ep.id);

    if (bestVid && best >= 40) {
      const rank      = rankMap[bestVid.videoId] || '--';
      const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
      const rankColor = rank === 1 ? '#ffcc00' : rank <= 3 ? '#ff8844' : '#888';
      node.innerHTML =
        '<a href="https://youtube.com/watch?v=' + bestVid.videoId + '" target="_blank" onclick="event.stopPropagation()" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;">' +
          '<span style="font-size:10px;color:#ff4444;font-weight:700;">▶ ' + window._ytFormatViews(bestVid.viewCount) + ' views</span>' +
          '<span style="font-size:11px;font-weight:800;color:' + rankColor + ';">' + rankLabel + '</span>' +
        '</a>';
      if (delBtn) {
        delBtn.disabled = true;
        delBtn.style.opacity = '0.3';
        delBtn.title = 'YouTube pe upload ho chuka — delete nahi kar sakte';
      }
    } else {
      node.innerHTML = '<span style="font-size:10px;color:#553333;font-weight:600;">❌ Not Uploaded</span>';
    }
  });
}

// ── Delete single episode ──
async function _deleteEpisode(epId, baseTitle, season) {
  const ep = await window.db_getEpisode(epId);
  if (ep) {
    // Only block if DEFINITELY uploaded — any error = allow delete
    let uploaded = false;
    try {
      if (window._fetchYtVideos && window._ytMatchScore) {
        const data = await window._fetchYtVideos();
        const { videos } = data || {};
        if (videos && videos.length) {
          const matchTitle = ep.ytTitle || (ep.title || '').split(' | ')[1] || ep.title || '';
          let best = 0;
          videos.forEach(v => {
            const s = window._ytMatchScore(matchTitle, v.title, v.description);
            if (s > best) best = s;
          });
          uploaded = best >= 40;
        }
      }
    } catch { uploaded = false; }

    if (uploaded) {
      toast('❌ YouTube pe upload hai — delete nahi kar sakte!');
      return;
    }
  }
  if (!confirm('Is episode ko delete karo?')) return;
  await window.db_deleteEpisode(epId);
  toast('🗑 Episode delete ho gaya');

  // Check remaining episodes in this season
  const remaining = await window.db_getEpisodes();
  const seasonEps = remaining.filter(e =>
    (e.title || '').split(' | ')[0].trim() === baseTitle &&
    (e.season || 'SEASON 1') === season
  );
  if (seasonEps.length === 0) {
    // Season empty — check if whole story is empty
    const storyEps = remaining.filter(e =>
      (e.title || '').split(' | ')[0].trim() === baseTitle
    );
    if (storyEps.length === 0) {
      // Story completely deleted — go to My Stories
      toast('🗑 Story bhi delete ho gayi');
      showScreen('screenMyStories');
      renderMyStories();
    } else {
      // Just this season empty — go back to seasons
      openSeasonsScreen(baseTitle);
    }
  } else {
    openEpisodesScreen(baseTitle, season);
  }
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

// ══ showScreen PATCH ══
(function _patchShowScreen() {
  const orig = window.showScreen;
  if (!orig) return setTimeout(_patchShowScreen, 50);
  window.showScreen = function(id) {
    orig(id);
    if (id === 'screenSetup' || id === 'screenStory') bnavSetActive('generate');
    else if (id === 'screenMyStories' || id === 'screenSeasons' || id === 'screenEpisodes') bnavSetActive('stories');
    else if (id === 'screenYoutube')   bnavSetActive('youtube');
    else if (id === 'screenProfile')   bnavSetActive('profile');
  };
})();

// ══ INIT ══
async function _appLoad() {
  await load();
  if (state.channel && !window.ytFetchedChannelName) {
    window.ytFetchedChannelName = state.channel;
  }
  restoreSetupForm();
  renderSetupEpList();
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

function openImgModal(btn) {
  const prompt = btn.dataset.prompt.replace(/&quot;/g, '"');
  _launchImgModal(prompt);
}

function openThumbModal(text) {
  _launchImgModal(text);
}

function _launchImgModal(prompt) {
  const modal  = document.getElementById('imgGenModal');
  const iframe = document.getElementById('imgGenIframe');
  if (!modal || !iframe) { console.warn('imgGenModal not found'); return; }
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

document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('imgGenModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeImgModal();
    });
  }
});

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
