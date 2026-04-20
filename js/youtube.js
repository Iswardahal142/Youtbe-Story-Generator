// ══ YOUTUBE PANEL ══
// ══ CHANNEL NAME AUTO-FETCH ══
async function ytAutoFetchChannelName() {
  try {
    const data = await fetch('/api/youtube').then(r => r.json());
    const name = data.channelName || data.channel_name || '';
    if (name) {
      // state mein save karo
      if (window.state) state.channel = name;
      // Setup screen ka input update karo (readonly)
      const inp = document.getElementById('cfgChannel');
      if (inp) {
        inp.value = name;
        inp.readOnly = true;
        inp.style.cssText += ';opacity:0.6;cursor:not-allowed;background:#0a000a;border-color:#220022;';
        // Label ke baad "auto" badge add karo
        const label = inp.closest('.field')?.querySelector('label');
        if (label && !label.querySelector('.yt-auto-badge')) {
          const badge = document.createElement('span');
          badge.className = 'yt-auto-badge';
          badge.style.cssText = 'margin-left:6px;font-size:9px;color:#ff4444;background:rgba(200,0,0,0.12);border:1px solid #440000;padding:1px 6px;border-radius:10px;letter-spacing:1px;vertical-align:middle;';
          badge.textContent = '▶ YouTube se auto';
          label.appendChild(badge);
        }
      }
    }
  } catch(e) {
    // Silent fail — default value rehne do
  }
}

// App load hone par auto-fetch karo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(ytAutoFetchChannelName, 1500));
} else {
  setTimeout(ytAutoFetchChannelName, 1500);
}



// ── Checklist ──
const YT_CHECK_SK = 'kaali_raat_yt_checks';
// These items are auto-managed — user can't manually toggle them
const AUTO_MANAGED_CHECKS = ['chk-title', 'chk-desc', 'chk-thumbnail'];

function getChecks() {
  try { return JSON.parse(localStorage.getItem(YT_CHECK_SK + '_' + (state.currentEpId||'x'))) || {}; } catch { return {}; }
}
function saveChecks(c) {
  try { localStorage.setItem(YT_CHECK_SK + '_' + (state.currentEpId||'x'), JSON.stringify(c)); } catch {}
}
function toggleCheck(id) {
  // Auto-managed items can't be manually toggled
  if (AUTO_MANAGED_CHECKS.includes(id)) { toast('⚠️ Yeh auto-update hota hai — pehle generate karo'); return; }
  const checks = getChecks();
  checks[id] = !checks[id];
  saveChecks(checks);
  renderYtChecklist();
}
function renderYtChecklist() {
  // Auto-sync status from generated flags
  const s = _ytGetStatus();
  const checks = getChecks();
  if (s.title)     checks['chk-title']     = true;
  if (s.desc)      checks['chk-desc']      = true;
  if (s.thumbnail) checks['chk-thumbnail'] = true;
  saveChecks(checks);

  const ids = ['chk-story','chk-narration','chk-thumbnail','chk-title','chk-desc','chk-chapters','chk-upload'];
  let done = 0;
  ids.forEach(function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const checked = !!checks[id];
    const isAuto = AUTO_MANAGED_CHECKS.includes(id);
    if (checked) { el.classList.add('checked'); el.querySelector('.yt-check-icon').textContent = '✅'; done++; }
    else { el.classList.remove('checked'); el.querySelector('.yt-check-icon').textContent = '⬜'; }
    // Visual hint for auto-managed items
    el.style.opacity = isAuto && !checked ? '0.6' : '1';
    el.title = isAuto ? (checked ? 'Auto-generated ✅' : 'Generate karne par auto-check hoga') : '';
  });
  const fill = document.getElementById('ytCheckFill');
  const prog = document.getElementById('ytCheckProgress');
  if (fill) fill.style.width = ((done/ids.length)*100) + '%';
  if (prog) {
    prog.textContent = done + ' / ' + ids.length + ' complete' + (done === ids.length ? ' 🎉 Ready to upload!' : '');
    prog.style.color = done === ids.length ? '#44bb66' : '#666';
  }
}

// ── Helper: copy button ──
function ytCopyBtn(text, label) {
  const btn = document.createElement('button');
  btn.className = 'yt-copy-btn';
  btn.textContent = label || '📋 Copy';
  btn.onclick = function() {
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = '✅ Copied!';
      btn.classList.add('copied');
      setTimeout(function() { btn.textContent = label || '📋 Copy'; btn.classList.remove('copied'); }, 2200);
    }).catch(function() { toast('❌ Copy nahi hua'); });
  };
  return btn;
}

// ── Title Generator ──
async function generateYtTitles() {
  if (!state.storyChunks.length) { toast('⚠️ Pehle story complete karo!'); return; }
  const btn = document.getElementById('genYtTitlesBtn');
  const out = document.getElementById('ytTitlesOut');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Titles ban rahe hain...';
  out.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>AI clickbait titles soch raha hai...</div>';

  const storyText = state.storyChunks.map(function(c){ return c.text; }).join('\n\n').slice(0, 1200);
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 600,
        temperature: 0.9,
        messages: [{
          role: 'user',
          content: `Tu ek viral Hindi YouTube horror channel ka title expert hai.

Story Title: "${state.title}"
Story Summary (first part): ${storyText.slice(0,600)}

Iske liye 7 VIRAL YouTube titles banao. Rules:
- PURE HINDI DEVANAGARI script mein — koi English nahi (channel name/ep number ok)
- High CTR ke liye — suspense, curiosity, fear trigger kare
- Mix karo: question format, shocking statement, cliffhanger, list format
- 50-70 characters each
- Episode number include karo: "${state.epNum}"

JSON array format mein SIRF return karo:
["title 1", "title 2", "title 3", "title 4", "title 5", "title 6", "title 7"]`
        }]
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '[]';
    const clean = raw.replace(/```json|```/g,'').trim();
    const titles = JSON.parse(clean);

    // Store all titles, show one at a time
    window._ytAllTitles = titles;
    window._ytTitleIdx = 0;

    function showTitleAtIdx(idx) {
      const t = window._ytAllTitles[idx];
      const card = document.createElement('div');
      card.className = 'yt-output-card';
      const label = document.createElement('div');
      label.style.cssText = 'font-size:10px;color:#44bb66;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;';
      label.textContent = '🎯 Title ' + (idx+1) + ' / ' + window._ytAllTitles.length;
      card.appendChild(label);
      const txt = document.createElement('div');
      txt.className = 'yt-title-text';
      txt.style.cssText = 'font-size:15px;font-weight:700;color:var(--bone);line-height:1.5;padding:10px 0;';
      txt.textContent = t;
      card.appendChild(txt);
      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:8px;margin-top:4px;';
      const copyB = ytCopyBtn(t, '📋 Copy');
      copyB.style.flex = '1';
      const nextB = document.createElement('button');
      nextB.className = 'yt-copy-btn';
      nextB.style.cssText = 'flex:1;border-color:#553300;color:#ffaa44;';
      nextB.textContent = '➡️ Alag Title';
      nextB.onclick = function() {
        window._ytTitleIdx = (window._ytTitleIdx + 1) % window._ytAllTitles.length;
        out.innerHTML = '';
        out.appendChild(showTitleCard(window._ytTitleIdx));
      };
      btnRow.appendChild(copyB);
      btnRow.appendChild(nextB);
      card.appendChild(btnRow);
      return card;
    }

    function showTitleCard(idx) { return showTitleAtIdx(idx); }

    out.innerHTML = '';
    out.appendChild(showTitleAtIdx(0));
    toast('✅ Title ready! ➡️ se alag title dekho');
    // Mark title as generated
    _ytSetStatus('title', true);
    updateYtStatusBadge();
  } catch (err) {
    out.innerHTML = '<div class="analysis-empty">❌ Error: ' + err.message + '</div>';
  }
  btn.disabled = false;
  btn.innerHTML = '🔄 Dobara Generate Karo';
}

// ── Description + Tags Generator ──
async function generateYtDesc() {
  if (!state.storyChunks.length) { toast('⚠️ Pehle story complete karo!'); return; }
  const btn = document.getElementById('genYtDescBtn');
  const out = document.getElementById('ytDescOut');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Description ban raha hai...';
  out.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>SEO description aur tags ban rahe hain...</div>';

  const storyText = state.storyChunks.map(function(c){ return c.text; }).join('\n\n').slice(0, 1500);
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: `Tu ek Hindi YouTube horror channel "${state.channel}" ka SEO expert hai.

Story: "${state.title}" | ${state.season} ${state.epNum}
Story text: ${storyText.slice(0,800)}

Ek complete YouTube upload description banao. Exactly iss format mein:

---DESCRIPTION---
[Compelling 2-3 line intro in Hindi about this episode — suspenseful, no spoilers]

📌 ${state.season} ${state.epNum}: [title]

[4-5 lines story summary in Hindi — engaging, leave on cliffhanger]

━━━━━━━━━━━━━━━━━━━━━━
🔔 Channel subscribe karo: @${state.channel.replace(/\s+/g,'').toLowerCase()}
👍 Like karo agar story acha laga
💬 Comment mein batao aage kya hoga
━━━━━━━━━━━━━━━━━━━━━━

⚠️ Yeh kahaniyaan sirf entertainment ke liye hain.

---TAGS---
[30 comma-separated YouTube tags — mix of Hindi story keywords, horror terms, channel name, episode keywords]

---HASHTAGS---
[15 hashtags for description — #HindiHorrorStory #KaaliRaat etc]
---END---

PURE HINDI DEVANAGARI mein likho (tags/hashtags English ok hai)`
        }]
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    // Parse sections
    const descMatch = raw.match(/---DESCRIPTION---([\s\S]*?)---TAGS---/);
    const tagsMatch = raw.match(/---TAGS---([\s\S]*?)---HASHTAGS---/);
    const hashMatch = raw.match(/---HASHTAGS---([\s\S]*?)---END---/);

    const desc = descMatch ? descMatch[1].trim() : raw;
    const tags = tagsMatch ? tagsMatch[1].trim() : '';
    const hash = hashMatch ? hashMatch[1].trim() : '';
    const fullCopy = desc + '\n\n' + hash + '\n\nTags: ' + tags;

    const card = document.createElement('div');
    card.className = 'yt-output-card';

    // Description section
    const descLabel = document.createElement('div');
    descLabel.style.cssText = 'font-size:10px;color:#4488ff;letter-spacing:2px;text-transform:uppercase;';
    descLabel.textContent = '📝 Description';
    card.appendChild(descLabel);
    const descBox = document.createElement('div');
    descBox.className = 'yt-desc-box';
    descBox.textContent = desc;
    card.appendChild(descBox);
    const copyDescBtn = ytCopyBtn(desc, '📋 Description Copy');
    card.appendChild(copyDescBtn);

    if (hash) {
      const hashLabel = document.createElement('div');
      hashLabel.style.cssText = 'font-size:10px;color:#4488ff;letter-spacing:2px;text-transform:uppercase;margin-top:6px;';
      hashLabel.textContent = '# Hashtags';
      card.appendChild(hashLabel);
      const hashBox = document.createElement('div');
      hashBox.className = 'yt-desc-box';
      hashBox.style.color = '#aabbff';
      hashBox.style.fontSize = '12px';
      hashBox.textContent = hash;
      card.appendChild(hashBox);
      card.appendChild(ytCopyBtn(hash, '📋 Hashtags Copy'));
    }

    if (tags) {
      const tagsLabel = document.createElement('div');
      tagsLabel.style.cssText = 'font-size:10px;color:#4488ff;letter-spacing:2px;text-transform:uppercase;margin-top:6px;';
      tagsLabel.textContent = '🏷 Tags';
      card.appendChild(tagsLabel);
      const tagsBox = document.createElement('div');
      tagsBox.className = 'yt-desc-box';
      tagsBox.style.color = '#888';
      tagsBox.style.fontSize = '12px';
      tagsBox.textContent = tags;
      card.appendChild(tagsBox);
      card.appendChild(ytCopyBtn(tags, '📋 Tags Copy'));
    }

    // Copy all button
    const copyAllRow = document.createElement('div');
    copyAllRow.style.cssText = 'border-top:1px solid #220000;padding-top:10px;margin-top:4px;';
    const copyAllBtn = ytCopyBtn(fullCopy, '📋 Sab Ek Saath Copy (Description + Tags + Hashtags)');
    copyAllBtn.style.cssText = 'background:#0a0a00;border-color:#665500;color:#ffcc44;padding:10px 14px;border-radius:8px;font-size:12px;width:100%;cursor:pointer;';
    copyAllRow.appendChild(copyAllBtn);
    card.appendChild(copyAllRow);

    out.innerHTML = '';
    out.appendChild(card);
    toast('✅ Description ready!');
    // Mark desc as generated
    _ytSetStatus('desc', true);
    updateYtStatusBadge();
  } catch (err) {
    out.innerHTML = '<div class="analysis-empty">❌ Error: ' + err.message + '</div>';
  }
  btn.disabled = false;
  btn.innerHTML = '🔄 Dobara Generate Karo';
}

// ── Chapters / Timestamps Generator ──
async function generateYtChapters() {
  if (!state.storyChunks.length) { toast('⚠️ Pehle story complete karo!'); return; }
  const lenInput = document.getElementById('ytVideoLength');
  const videoMins = parseFloat(lenInput.value) || 0;
  if (!videoMins || videoMins < 1) { toast('⚠️ Video ki length (minutes) daalo!'); lenInput.focus(); return; }

  const btn = document.getElementById('genYtChaptersBtn');
  const out = document.getElementById('ytChaptersOut');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Chapters ban rahe hain...';
  out.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>Timestamps calculate ho rahe hain...</div>';

  const partsCount = state.storyChunks.length;
  const partTitles = state.storyChunks.map(function(c, i) {
    return 'Part ' + (i+1) + ': ' + c.text.slice(0,80) + '...';
  }).join('\n');

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 500,
        temperature: 0.5,
        messages: [{
          role: 'user',
          content: `YouTube chapters/timestamps banao iss horror story ke liye.

Story: "${state.title}" | ${state.epNum}
Total video length: ${videoMins} minutes
Story parts count: ${partsCount}

Story parts summary:
${partTitles}

Rules:
- Pehla chapter HAMESHA "0:00 Intro" hona chahiye
- Last chapter "The End" hona chahiye
- Total ${partsCount + 3} chapters banao (intro + story parts + end/outro)
- Video time ${videoMins} minutes mein equally distribute karo
- Chapter names Hindi mein (short, punchy, 3-5 words)
- Format: MM:SS Chapter Name

SIRF timestamps list return karo, koi extra text nahi. Example:
0:00 Intro
0:45 अंधेरी रात का आगाज़
2:30 पुरानी हवेली में दाखिल
...`
        }]
      })
    });
    const data = await res.json();
    const chaptersText = data.choices?.[0]?.message?.content?.trim() || '';

    const card = document.createElement('div');
    card.className = 'yt-output-card';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:10px;color:#ffaa00;letter-spacing:2px;text-transform:uppercase;';
    label.textContent = '⏱ YouTube Chapters — Description mein paste karo';
    card.appendChild(label);

    const chapBox = document.createElement('div');
    chapBox.className = 'yt-chapters-box';
    chapBox.textContent = chaptersText;
    card.appendChild(chapBox);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#444;line-height:1.6;';
    hint.textContent = '💡 Yeh text YouTube description mein paste karo — YouTube automatically chapters banata hai';
    card.appendChild(hint);

    card.appendChild(ytCopyBtn(chaptersText, '📋 Chapters Copy Karo'));

    out.innerHTML = '';
    out.appendChild(card);
    toast('✅ Chapters ready!');
  } catch (err) {
    out.innerHTML = '<div class="analysis-empty">❌ Error: ' + err.message + '</div>';
  }
  btn.disabled = false;
  btn.innerHTML = '⏱ Chapters Generate Karo';
}

// ── Thumbnail Prompt Enhancer ──
async function enhanceThumbPrompt() {
  const input = document.getElementById('ytThumbInput').value.trim();
  const btn = document.getElementById('genYtThumbBtn');
  const out = document.getElementById('ytThumbOut');

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Enhance ho raha hai...';
  out.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>YouTube viral thumbnail prompt ban raha hai...</div>';

  const basePrompt = input || ('Hindi horror story thumbnail for: ' + state.title + ' ' + state.epNum);

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 400,
        temperature: 0.8,
        messages: [{
          role: 'user',
          content: `Tu ek viral YouTube thumbnail expert hai jo image generation prompts likhta hai.

Story: "${state.title}" — ${state.epNum}
Base prompt: "${basePrompt}"

Iske liye 2 DIFFERENT YouTube thumbnail prompts banao:

PROMPT 1 — FACE CLOSE-UP STYLE:
- Terrified/shocked face extreme close-up
- Eyes wide with fear, dramatic lighting
- Story title text overlay suggestion

PROMPT 2 — CINEMATIC SCENE STYLE:
- Most dramatic/scary scene from the story
- Dark atmospheric composition
- Story title text overlay suggestion

Rules for BOTH prompts:
- YouTube thumbnail 16:9, 1280x720 aspect ratio
- Hyper-realistic, cinematic photography style
- Dark horror color grading (deep reds, blacks)
- High contrast for small thumbnail visibility
- Include: "text overlay: [TITLE IN HINDI]" in prompt
- Max 100 words each
- English only (for image gen tools)

Format:
PROMPT 1:
[prompt here]

PROMPT 2:
[prompt here]`
        }]
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    const p1Match = raw.match(/PROMPT 1[:\s]*([\s\S]*?)(?=PROMPT 2|$)/);
    const p2Match = raw.match(/PROMPT 2[:\s]*([\s\S]*?)$/);
    const p1 = p1Match ? p1Match[1].trim() : raw;
    const p2 = p2Match ? p2Match[1].trim() : '';

    const card = document.createElement('div');
    card.className = 'yt-output-card';

    function addPromptSection(label, prompt, color) {
      if (!prompt) return;
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;letter-spacing:2px;text-transform:uppercase;color:' + color + ';';
      lbl.textContent = label;
      card.appendChild(lbl);
      const box = document.createElement('div');
      box.className = 'yt-enhanced-box';
      box.style.borderColor = color + '44';
      box.textContent = prompt;
      card.appendChild(box);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
      const copyBtn = ytCopyBtn(prompt, '📋 Copy Prompt');
      const openBtn = document.createElement('button');
      openBtn.className = 'yt-copy-btn';
      openBtn.style.borderColor = '#443300';
      openBtn.style.color = '#ffaa44';
      openBtn.textContent = '🖼 Image Generator mein Open Karo';
      openBtn.onclick = function() {
        const iframe = document.getElementById('imgGenIframe');
        iframe.src = '/Ai/index.html?prompt=' + encodeURIComponent(prompt);
        document.getElementById('imgGenModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
      };
      row.appendChild(copyBtn);
      row.appendChild(openBtn);
      card.appendChild(row);
    }

    addPromptSection('📸 Prompt 1 — Face Close-Up Style', p1, '#cc88ff');
    if (p2) {
      const divider = document.createElement('div');
      divider.style.cssText = 'border-top:1px solid #220022;margin:4px 0;';
      card.appendChild(divider);
      addPromptSection('🎬 Prompt 2 — Cinematic Scene Style', p2, '#ff88cc');
    }

    out.innerHTML = '';
    out.appendChild(card);
    toast('✅ Thumbnail prompts ready!');
    // Mark thumbnail as generated
    _ytSetStatus('thumbnail', true);
    updateYtStatusBadge();
  } catch (err) {
    out.innerHTML = '<div class="analysis-empty">❌ Error: ' + err.message + '</div>';
  }
  btn.disabled = false;
  btn.innerHTML = '🔄 Dobara Enhance Karo';
}

// ── Auto-open YT tab from story end banner ──
function goToYtExport() {
  if (window.showScreen) showScreen('screenYoutube');
  if (window.bnavSetActive) bnavSetActive('youtube');
  renderYtChecklist();
  if (window.updateYtStatusBadge) updateYtStatusBadge();
  setTimeout(function() {
    if (window.ytTabComparison) window.ytTabComparison().catch(function(){});
  }, 300);
}
// ══ YT UPLOAD STATUS TRACKING ══
const YT_STATUS_SK = 'kaali_raat_yt_status';

function _ytStatusKey() {
  return YT_STATUS_SK + '_' + (state.currentEpId || 'x');
}
function _ytGetStatus() {
  try { return JSON.parse(localStorage.getItem(_ytStatusKey())) || {}; } catch { return {}; }
}
function _ytSetStatus(key, val) {
  const s = _ytGetStatus();
  s[key] = val;
  try { localStorage.setItem(_ytStatusKey(), JSON.stringify(s)); } catch {}
}

function updateYtStatusBadge() {
  const s      = _ytGetStatus();
  const checks = getChecks();
  const hasTitle = !!s.title;
  const hasDesc  = !!s.desc;
  const uploadDone = !!checks['chk-upload'];

  // Bottom nav badge on YouTube button
  const ytBtn = document.getElementById('bnavYoutube');
  if (ytBtn) {
    let existing = ytBtn.querySelector('.yt-status-dot');
    if (!existing) {
      existing = document.createElement('span');
      existing.className = 'yt-status-dot';
      ytBtn.appendChild(existing);
    }
    if (uploadDone) {
      existing.style.background = '#44bb66'; // green = uploaded
      existing.title = 'Uploaded ✅';
    } else if (hasTitle && hasDesc) {
      existing.style.background = '#ffcc44'; // yellow = ready
      existing.title = 'Ready to upload';
    } else {
      existing.style.background = '#cc4444'; // red = missing
      existing.title = 'Title/Desc missing';
    }
  }

  // Status card inside YT panel
  renderYtStatusCard();
}

function renderYtStatusCard() {
  const card = document.getElementById('ytUploadStatusCard');
  if (!card) return;
  const s      = _ytGetStatus();
  const checks = getChecks();

  const hasTitle   = !!s.title;
  const hasDesc    = !!s.desc;
  const hasThumb   = !!checks['chk-thumbnail'];
  const uploaded   = !!checks['chk-upload'];

  const rows = [
    { label: '📝 Title', done: hasTitle,  miss: 'Title generate nahi hua — upar se banao' },
    { label: '📄 Description', done: hasDesc, miss: 'Description generate nahi hua' },
    { label: '🖼 Thumbnail', done: hasThumb, miss: 'Thumbnail abhi ready nahi' },
    { label: '⬆️ Uploaded', done: uploaded, miss: 'YouTube pe upload pending hai' },
  ];

  const allDone = rows.every(r => r.done);

  card.innerHTML = `
    <div style="font-size:10px;color:#ff4444;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">
      📊 Upload Status — ${state.epNum || 'EP'}
    </div>
    ${rows.map(r => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1a0000;">
        <span style="font-size:16px;">${r.done ? '✅' : '❌'}</span>
        <div style="flex:1;">
          <div style="font-size:13px;color:${r.done ? '#aaa' : '#ddd'};">${r.label}</div>
          ${!r.done ? `<div style="font-size:11px;color:#cc4444;margin-top:1px;">${r.miss}</div>` : ''}
        </div>
      </div>
    `).join('')}
    <div style="margin-top:10px;font-size:12px;color:${allDone ? '#44bb66' : '#666'};">
      ${allDone ? '🎉 Sab ready hai — upload karo!' : `⚠️ ${rows.filter(r=>!r.done).length} cheez${rows.filter(r=>!r.done).length>1?'en':''} baaki hain`}
    </div>
  `;
}

// Call on YT tab open
const _origRenderYtChecklist = window.renderYtChecklist || renderYtChecklist;
