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

// ══════════════════════════════════════════════
// 1. MY STORIES — har story card pe views badge
// ══════════════════════════════════════════════
async function ytMatchMyStories() {
  // All story cards dhundho
  const cards = document.querySelectorAll('.story-card[data-story-title]');
  if (!cards.length) return;

  let data;
  try {
    data = await _fetchYtVideos();
  } catch (err) {
    console.warn('YT match skip:', err.message);
    return;
  }

  const { videos } = data;
  if (!videos?.length) return;

  cards.forEach(card => {
    const storyTitle = card.dataset.storyTitle || '';
    if (!storyTitle) return;

    // Best matching video dhundho
    let bestScore = 0;
    let bestVideo = null;
    videos.forEach(v => {
      const score = _ytMatchScore(storyTitle, v.title, v.description);
      if (score > bestScore) { bestScore = score; bestVideo = v; }
    });

    // 40+ score pe match maano
    const viewsBadge = card.querySelector('.yt-views-badge');
    if (!viewsBadge) return;

    if (bestVideo && bestScore >= 40) {
      viewsBadge.innerHTML = `
        <a href="https://youtube.com/watch?v=${bestVideo.videoId}" target="_blank"
           onclick="event.stopPropagation()"
           style="display:inline-flex;align-items:center;gap:5px;color:#ff4444;text-decoration:none;font-size:11px;font-weight:700;">
          <span style="color:#ff4444;">▶</span>
          <span>${_ytFormatViews(bestVideo.viewCount)} views</span>
        </a>`;
    } else {
      viewsBadge.innerHTML = '';
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

  // Matching
  const storyTitle = lastStory.title || '';
  const storyDesc  = (lastStory.storyChunks || []).map(c => c.text).join(' ').slice(0, 500);

  const titleScore = _ytMatchScore(storyTitle, lastVideo.title, '');
  const descScore  = _ytMatchScore(storyDesc.slice(0, 100), '', lastVideo.description);
  const overallScore = _ytMatchScore(storyTitle, lastVideo.title, lastVideo.description);

  const titleMatch  = titleScore  >= 50;
  const descMatch   = descScore   >= 30;
  const fullyMatch  = overallScore >= 60;

  const check = (ok, label) =>
    `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1a0000;">
      <span style="font-size:18px;">${ok ? '✅' : '❌'}</span>
      <span style="font-size:13px;color:${ok ? '#aaa' : '#ddd'};">${label}</span>
    </div>`;

  const videoDateStr = lastVideo.publishedAt
    ? new Date(lastVideo.publishedAt).toLocaleDateString('hi-IN')
    : '';

  container.innerHTML = `
    <div style="font-size:10px;color:#ff4444;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">
      📺 Last Video vs Last Story
    </div>

    <!-- Last story info -->
    <div style="background:#0a000a;border:1px solid #220022;border-radius:8px;padding:10px;margin-bottom:10px;">
      <div style="font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">📚 Last Story</div>
      <div style="font-size:13px;font-weight:700;color:var(--bone);">${storyTitle}</div>
      <div style="font-size:11px;color:#444;margin-top:2px;">${lastStory.season || ''} · ${lastStory.epNum || ''}</div>
    </div>

    <!-- Last video info -->
    <div style="background:#0a0000;border:1px solid #220000;border-radius:8px;padding:10px;margin-bottom:12px;display:flex;gap:10px;align-items:flex-start;">
      ${lastVideo.thumbnail
        ? `<img src="${lastVideo.thumbnail}" style="width:72px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;" onerror="this.style.display='none'">`
        : ''}
      <div style="flex:1;overflow:hidden;">
        <div style="font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;">▶ Last YouTube Video</div>
        <div style="font-size:12px;font-weight:700;color:#ffaaaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${lastVideo.title}</div>
        <div style="font-size:11px;color:#555;margin-top:2px;">
          ${_ytFormatViews(lastVideo.viewCount)} views · ${videoDateStr}
        </div>
      </div>
    </div>

    <!-- Match results -->
    ${check(titleMatch,  'Title match hua')}
    ${check(descMatch,   'Description match hui')}
    ${check(fullyMatch,  fullyMatch ? '✨ Video Uploaded' : 'Video Not Uploaded')}

    <!-- Score hint -->
    <div style="margin-top:10px;font-size:11px;color:#333;text-align:right;">
      Match score: ${Math.round(overallScore)}%
    </div>
  `;
}

// ══ INIT — YT tab open hone par comparison run karo ══
// app.js ke bnavGo('youtube') ya goToYtExport ke baad call hoga
window.ytTabComparison  = ytTabComparison;
window.ytMatchMyStories = ytMatchMyStories;
