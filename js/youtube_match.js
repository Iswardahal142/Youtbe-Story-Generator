// ══ YOUTUBE MATCH — youtube_match.js ══
// 1. My Stories mein har story card pe views dikhao (auto match)
// 2. YT Tab mein last video vs last story comparison

// ── Helper: normalize text for matching ──
function _ytNormalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\u0900-\u097F\w\s]/g, '') // keep Devanagari + word chars
    .trim();
}

// Partial match — storyTitle ke words video title/desc mein hain?
function _ytMatchScore(storyTitle, videoTitle, videoDesc) {
  const sNorm  = _ytNormalize(storyTitle);
  const vTitle = _ytNormalize(videoTitle);
  const vDesc  = _ytNormalize(videoDesc);

  if (!sNorm) return 0;

  // Exact title match — highest score
  if (vTitle === sNorm) return 100;
  // Title contains story title
  if (vTitle.includes(sNorm)) return 90;
  // Story title contains video title
  if (sNorm.includes(vTitle) && vTitle.length > 4) return 80;

  // Word-level match — count how many words of story title appear in video title/desc
  const words = sNorm.split(' ').filter(w => w.length > 2);
  if (!words.length) return 0;
  const titleHits = words.filter(w => vTitle.includes(w)).length;
  const descHits  = words.filter(w => vDesc.includes(w)).length;
  const titleScore = (titleHits / words.length) * 70;
  const descScore  = (descHits  / words.length) * 30;
  return titleScore + descScore;
}

// ── Cache ──
let _ytVideosCache = null;
let _ytCacheTime   = 0;
const YT_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function _fetchYtVideos() {
  const now = Date.now();
  if (_ytVideosCache && (now - _ytCacheTime) < YT_CACHE_TTL) {
    return _ytVideosCache;
  }
  const res  = await fetch('/api/youtube');
  if (!res.ok) throw new Error(`YouTube API: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  _ytVideosCache = data;
  _ytCacheTime   = now;
  return data;
}

// ── Format view count: 1.2K, 4.5L, etc ──
function _ytFormatViews(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 100000)  return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// ── Top video context — story generation mein use hoga ──
window._ytTopVideoContext = null;

// ══════════════════════════════════════════════
// 1. MY STORIES — har story card pe views + rank badge
// ══════════════════════════════════════════════
async function ytMatchMyStories() {
  const cards = document.querySelectorAll('.story-card[data-story-title]');
  if (!cards.length) return;

  let data;
  try {
    data = await _fetchYtVideos();
  } catch (err) {
    console.warn('YT match skip:', err.message);
    cards.forEach(card => {
      const b = card.querySelector('.yt-views-badge');
      if (b) b.innerHTML = '<span style="font-size:10px;color:#553333;">❌ Not Uploaded</span>';
    });
    return;
  }

  const { videos } = data;
  if (!videos?.length) return;

  // Views ke hisaab se sort karke rank assign karo (rank 1 = sabse zyada views)
  const sorted = [...videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const rankMap = {};
  sorted.forEach((v, i) => { rankMap[v.videoId] = i + 1; });

  // Top video context globally store karo — story.js use karega
  if (sorted.length) {
    const top = sorted[0];
    window._ytTopVideoContext = {
      rank: 1,
      title: top.title || '',
      viewCount: top.viewCount || 0,
      description: (top.description || '').slice(0, 300),
    };
  }

  cards.forEach(card => {
    const storyTitle = card.dataset.storyTitle || '';
    if (!storyTitle) return;

    let bestScore = 0;
    let bestVideo = null;
    videos.forEach(v => {
      const score = _ytMatchScore(storyTitle, v.title, v.description);
      if (score > bestScore) { bestScore = score; bestVideo = v; }
    });

    const viewsBadge = card.querySelector('.yt-views-badge');
    if (!viewsBadge) return;

    if (bestVideo && bestScore >= 40) {
      const rank = rankMap[bestVideo.videoId] || '--';
      const rankColor = rank === 1 ? '#ffcc00' : rank <= 3 ? '#ff8844' : rank <= 10 ? '#aaaaaa' : '#555555';
      const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      viewsBadge.innerHTML = `
        <a href="https://youtube.com/watch?v=${bestVideo.videoId}" target="_blank"
           onclick="event.stopPropagation()"
           style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;">
          <span style="font-size:11px;font-weight:800;color:${rankColor};">${rankLabel}</span>
          <span style="font-size:11px;color:#ff4444;font-weight:700;">▶ ${_ytFormatViews(bestVideo.viewCount)} views</span>
        </a>`;
    } else {
      viewsBadge.innerHTML = `<span style="font-size:10px;color:#553333;font-weight:600;">❌ Not Uploaded</span>`;
    }
  });
}

// ══════════════════════════════════════════════
// 2. YT TAB — last video vs last story comparison
// ══════════════════════════════════════════════
async function ytTabComparison() {
  const container = document.getElementById('ytComparisonCard');
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:12px;color:#555;font-size:12px;">
      <div class="spinner"></div> YouTube se check ho raha hai...
    </div>`;

  // Last story fetch karo
  let lastStory = null;
  try {
    const eps = await window.db_getEpisodes();
    if (eps && eps.length) {
      // Most recently saved
      lastStory = eps.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
    }
  } catch (e) {}

  if (!lastStory) {
    container.innerHTML = `<div style="padding:12px;font-size:12px;color:#555;">📭 Koi story save nahi hui abhi.</div>`;
    return;
  }

  // YouTube last video fetch
  let lastVideo = null;
  let fetchErr  = null;
  try {
    const data = await _fetchYtVideos();
    lastVideo = data.lastVideo;
  } catch (err) {
    fetchErr = err.message;
  }

  if (fetchErr) {
    container.innerHTML = `
      <div style="padding:14px;">
        <div style="font-size:10px;color:#ff4444;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">⚠️ YouTube Error</div>
        <div style="font-size:12px;color:#cc4444;">${fetchErr}</div>
        <div style="font-size:11px;color:#444;margin-top:6px;">.env.local mein YOUTUBE_API_KEY aur YOUTUBE_CHANNEL_ID check karo.</div>
      </div>`;
    return;
  }

  if (!lastVideo) {
    container.innerHTML = `<div style="padding:12px;font-size:12px;color:#555;">📺 Channel pe koi video nahi mila.</div>`;
    return;
  }

  // Matching — ytTitle use karo agar available hai (exact YouTube title)
  const storyTitle    = lastStory.ytTitle || lastStory.title || '';
  const storyDesc     = lastStory.ytDesc  || (lastStory.storyChunks || []).map(c => c.text).join(' ').slice(0, 500);

  const titleScore   = _ytMatchScore(storyTitle, lastVideo.title, '');
  const descScore    = _ytMatchScore(storyDesc.slice(0, 100), '', lastVideo.description);
  const overallScore = _ytMatchScore(storyTitle, lastVideo.title, lastVideo.description);

  const titleMatch  = titleScore  >= 50;
  const descMatch   = descScore   >= 30;
  const fullyMatch  = overallScore >= 60;

  const videoDateStr = lastVideo.publishedAt
    ? new Date(lastVideo.publishedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
    : '';

  const matchPill = (ok, label) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:${ok ? 'rgba(0,180,80,0.07)' : 'rgba(255,60,60,0.07)'};border:1px solid ${ok ? 'rgba(0,180,80,0.18)' : 'rgba(255,60,60,0.15)'};">
      <div style="width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;background:${ok ? 'rgba(0,200,80,0.15)' : 'rgba(255,60,60,0.15)'};">${ok ? '✓' : '✕'}</div>
      <span style="font-size:12px;color:${ok ? '#66dd99' : '#ff7777'};font-weight:600;">${label}</span>
      <span style="margin-left:auto;font-size:10px;font-weight:700;color:${ok ? '#00cc55' : '#cc3333'};background:${ok ? 'rgba(0,180,80,0.12)' : 'rgba(200,0,0,0.12)'};padding:2px 7px;border-radius:20px;">${ok ? 'YES' : 'NO'}</span>
    </div>`;

  const scoreColor = overallScore >= 60 ? '#00cc55' : overallScore >= 30 ? '#ffaa00' : '#cc3333';
  const scoreWidth = Math.round(overallScore);

  container.innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:3px;height:14px;background:#ff4444;border-radius:2px;"></div>
        <span style="font-size:10px;color:#ff4444;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Last Video vs Last Story</span>
      </div>
      <span style="font-size:10px;color:#444;">📊 Match</span>
    </div>

    <!-- Story row -->
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:rgba(80,0,80,0.12);border:1px solid #2a0028;margin-bottom:8px;">
      <div style="width:36px;height:36px;border-radius:8px;background:rgba(120,0,120,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📚</div>
      <div style="flex:1;overflow:hidden;">
        <div style="font-size:9px;color:#666;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px;">Last Story</div>
        <div style="font-size:13px;font-weight:700;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${lastStory.ytTitle || lastStory.title}</div>
        ${lastStory.ytTitle ? '<div style="font-size:10px;color:#664444;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Story: ' + lastStory.title.split(' | ')[0] + '</div>' : ''}
        <div style="font-size:10px;color:#554455;margin-top:1px;">${lastStory.season || 'Season 1'} · ${lastStory.epNum || 'EP 01'}</div>
      </div>
    </div>

    <!-- YouTube video row -->
    <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:rgba(80,0,0,0.15);border:1px solid #2a0000;margin-bottom:14px;">
      ${lastVideo.thumbnail
        ? `<div style="position:relative;flex-shrink:0;">
             <img src="${lastVideo.thumbnail}" style="width:72px;height:42px;object-fit:cover;border-radius:6px;display:block;" onerror="this.parentElement.innerHTML='<div style=width:72px;height:42px;border-radius:6px;background:#1a0000;display:flex;align-items:center;justify-content:center;font-size:20px;>▶</div>'">
             <div style="position:absolute;bottom:3px;right:3px;background:rgba(0,0,0,0.8);border-radius:3px;padding:1px 4px;font-size:9px;color:#fff;font-weight:700;">YT</div>
           </div>`
        : `<div style="width:72px;height:42px;border-radius:6px;background:#1a0000;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">▶</div>`}
      <div style="flex:1;overflow:hidden;">
        <div style="font-size:9px;color:#666;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px;">Last YouTube Video</div>
        <div style="font-size:12px;font-weight:700;color:#ffaaaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${lastVideo.title}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
          <span style="font-size:10px;color:#ff4444;font-weight:700;">▶ ${_ytFormatViews(lastVideo.viewCount)} views</span>
          <span style="font-size:10px;color:#333;">·</span>
          <span style="font-size:10px;color:#444;">${videoDateStr}</span>
        </div>
      </div>
    </div>

    <!-- Score bar -->
    <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 10px;border:1px solid #1a1a1a;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:10px;color:#555;letter-spacing:1px;">MATCH SCORE</span>
        <span style="font-size:13px;font-weight:700;color:${scoreColor};">${scoreWidth}%</span>
      </div>
      <div style="height:4px;background:#1a1a1a;border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${scoreWidth}%;background:linear-gradient(90deg,${scoreColor}88,${scoreColor});border-radius:4px;transition:width 0.6s ease;"></div>
      </div>
    </div>
  `;
  // ── Checklist mein auto-inject match results ──
  _ytInjectChecklist('chk-title',  titleMatch,  'YouTube Title select kar liya',     'Title match hua ✓',       'Title match nahi hua');
  _ytInjectChecklist('chk-desc',   descMatch,   'Description copy ho gayi',          'Description match hui ✓', 'Description match nahi hui');
  _ytInjectChecklist('chk-upload', fullyMatch,  'Video YouTube pe upload ho gayi ✔', 'Video Uploaded ✓',        'Video Not Uploaded');
}

// ── Helper: checklist item ko auto-update karo match result se ──
function _ytInjectChecklist(itemId, matched, defaultLabel, matchLabel, noMatchLabel) {
  const el = document.getElementById(itemId);
  if (!el) return;

  const icon = el.querySelector('.yt-check-icon');
  const text = el.querySelector('span:last-child');

  if (matched) {
    // Auto-check — green tint
    el.style.background    = 'rgba(0,180,80,0.08)';
    el.style.border        = '1px solid rgba(0,180,80,0.25)';
    el.style.borderRadius  = '8px';
    if (icon) icon.textContent = '✅';
    if (text) {
      text.textContent = matchLabel;
      text.style.color = '#66dd99';
    }
    el.dataset.checked = 'true';
  } else {
    // Red tint — not matched
    el.style.background    = 'rgba(200,0,0,0.06)';
    el.style.border        = '1px solid rgba(200,0,0,0.18)';
    el.style.borderRadius  = '8px';
    if (icon) icon.textContent = '❌';
    if (text) {
      text.textContent = noMatchLabel;
      text.style.color = '#ff7777';
    }
    el.dataset.checked = 'false';
  }

  // Progress bar update karo
  if (typeof updateYtCheckProgress === 'function') updateYtCheckProgress();
}
// ══════════════════════════════════════════════
// 3. MY STORIES — per-episode YT upload badge
// ══════════════════════════════════════════════
async function ytMatchEpisodes() {
  // Saare episode rows jo render hue hain
  const epNodes = document.querySelectorAll('.ms-ep-yt-status[data-ep-id]');
  if (!epNodes.length) return;

  let data;
  try {
    data = await _fetchYtVideos();
  } catch (err) {
    epNodes.forEach(node => {
      node.innerHTML = '<span class="ms-ep-yt-badge" style="background:rgba(80,0,0,0.3);color:#553333;">❌ Not Uploaded</span>';
    });
    return;
  }

  const { videos } = data;
  if (!videos?.length) {
    epNodes.forEach(node => {
      node.innerHTML = '<span class="ms-ep-yt-badge" style="background:rgba(80,0,0,0.3);color:#553333;">❌ Not Uploaded</span>';
    });
    return;
  }

  // Views ke hisaab se rank
  const sorted = [...videos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const rankMap = {};
  sorted.forEach((v, i) => { rankMap[v.videoId] = i + 1; });

  // All episodes Firestore se ek baar fetch karo
  let allEps = [];
  try { allEps = await window.db_getEpisodes() || []; } catch(e) {}
  const epById = {};
  allEps.forEach(e => { epById[e.id] = e; });

  epNodes.forEach(node => {
    const epId = node.dataset.epId;
    const ep   = epById[epId];
    if (!ep) {
      node.innerHTML = '<span class="ms-ep-yt-badge" style="background:rgba(80,0,0,0.3);color:#553333;">❌ Not Uploaded</span>';
      return;
    }

    // Match karo episode ka ytTitle ya title se
    const matchTitle = ep.ytTitle || (ep.title || '').split(' | ')[1] || ep.title || '';
    let bestScore = 0, bestVideo = null;
    videos.forEach(v => {
      const score = _ytMatchScore(matchTitle, v.title, v.description);
      if (score > bestScore) { bestScore = score; bestVideo = v; }
    });

    if (bestVideo && bestScore >= 40) {
      const rank       = rankMap[bestVideo.videoId] || '--';
      const rankLabel  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const rankColor  = rank === 1 ? '#ffcc00' : rank <= 3 ? '#ff8844' : rank <= 10 ? '#aaaaaa' : '#666';
      node.innerHTML =
        '<a href="https://youtube.com/watch?v=' + bestVideo.videoId + '" target="_blank" onclick="event.stopPropagation()" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">' +
          '<span class="ms-ep-yt-badge" style="background:rgba(200,0,0,0.15);color:#ff4444;">▶ ' + _ytFormatViews(bestVideo.viewCount) + ' views</span>' +
          '<span style="font-size:10px;font-weight:800;color:' + rankColor + ';">' + rankLabel + '</span>' +
        '</a>';
    } else {
      node.innerHTML = '<span class="ms-ep-yt-badge" style="background:rgba(80,0,0,0.3);color:#553333;">❌ Not Uploaded</span>';
    }
  });
}

window.ytMatchEpisodes = ytMatchEpisodes;

// app.js ke bnavGo('youtube') ya goToYtExport ke baad call hoga
window.ytTabComparison  = ytTabComparison;
window.ytMatchMyStories = ytMatchMyStories;

// ── app.js ke liye expose karo ──
window._fetchYtVideos  = _fetchYtVideos;
window._ytMatchScore   = _ytMatchScore;
window._ytFormatViews  = _ytFormatViews;
