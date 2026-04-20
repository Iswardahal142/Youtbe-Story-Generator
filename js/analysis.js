// ══ ANALYSIS ══
function goToAnalysis() {
  if (!state.storyChunks.length) { toast('⚠️ Pehle kuch story likho!'); return; }
  showScreen('screenAnalysis');
  const savedEpId = state.savedScenesEpId;
  const curEpId = state.currentEpId;
  const sameEp = savedEpId === curEpId;

  // Scenes — only show if this story's scenes are generated
  const scenesOut = document.getElementById('scenesOutput');
  const genScenesBtn = document.getElementById('genScenesBtn');
  if (state.savedScenes && sameEp) {
    renderScenes(state.savedScenes);
    if (genScenesBtn) genScenesBtn.textContent = '🔄 Dobara Generate Karo';
  } else {
    state.savedScenes = null;
    if (scenesOut) scenesOut.innerHTML = '';
    if (genScenesBtn) genScenesBtn.textContent = '🎬 Scene Breakdown Generate Karo';
  }

  // Characters — only show if this story's chars are generated
  const charsOut = document.getElementById('charsOutput');
  const genCharsBtn = document.getElementById('genCharsBtn');
  if (state.savedChars && sameEp) {
    renderChars(state.savedChars);
    if (genCharsBtn) genCharsBtn.textContent = '🔄 Dobara Generate Karo';
  } else {
    state.savedChars = null;
    if (charsOut) charsOut.innerHTML = '';
    if (genCharsBtn) genCharsBtn.textContent = '👤 Character List Generate Karo';
  }

  // Hide YT panel by default
  const ytPanel = document.getElementById('panelYt');
  if (ytPanel) ytPanel.style.display = 'none';
}

function switchTab(tab) {
  // Only YT panel is toggled — scenes and chars are always shown
  const ytPanel = document.getElementById('panelYt');
  if (ytPanel) ytPanel.style.display = tab === 'yt' ? 'flex' : 'none';
  if (tab === 'yt') {
    renderYtChecklist();
    if (window.updateYtStatusBadge) updateYtStatusBadge();
  }
}

// ══ EXTRACT CHARACTER BIBLE (auto, silent) ══
async function extractCharacterBible(firstChunkText) {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano',
        max_tokens: 600,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `Story title: "${state.title}"\nStory idea: "${state.prompt}"\nFirst part: ${firstChunkText}\n\nIs story ke expected main characters ki visual description do for IMAGE GENERATION.\nFormat (JSON array):\n[{"name":"character name","visual":"detailed English visual description for image gen — age, build, face, hair, eye color, skin tone, clothing style, any distinctive features. Max 40 words."},...]\nSirf JSON array, koi extra text nahi.`
        }]
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    const clean = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
    const chars = JSON.parse(clean);
    if (Array.isArray(chars) && chars.length) {
      state.characterBible = chars;
      save();
    }
  } catch(e) { /* silent */ }
}

// ══ AUTO SCENE GENERATION (called after story ends) ══
async function generateScenesAuto() {
  const out = document.getElementById('scenesOutput');
  const btn = document.getElementById('genScenesBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Auto-generating...'; }
  if (out) out.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>20+ scenes ban rahe hain, thoda wait karo...</div>';

  const storyText = state.storyChunks.map(c => c.text).join('\n\n');
  const charDesc = state.characterBible
    ? '\n\nCHARACTER VISUAL BIBLE (inn descriptions ko EVERY scene ke imgprompt mein include karo — character wahan ho ya na ho, background mein bhi):\n' +
      state.characterBible.map(c => `${c.name}: ${c.visual}`).join('\n')
    : '';

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano',
        max_tokens: 4000,
        temperature: 0.35,
        messages: [{
          role: 'user',
          content: `Yeh Hindi horror story hai (Title: "${state.title}"):

${storyText}
${charDesc}

Is poori story ko MINIMUM 20 SCENES mein tod do. Har scene 1 story part ka ek beat hai.

CONSISTENCY RULES (BAHUT ZAROORI):
- Har scene ka imgprompt PICHLE scene se location/character visually connect hona chahiye
- Characters ki appearance (clothing, hair, face) BILKUL SAME rahni chahiye har scene mein
- Agar location same hai toh describe same rakho (same walls, same furniture, same lighting direction)
- Har imgprompt mein character ka full visual (height, clothing, face) repeat karo taaki AI consistent rakh sake
- imgprompt English mein, baaki sab Hindi mein

Har scene ke liye EXACTLY yeh format:

SCENE_START
num: [number]
title: [Hindi scene title]
location: [exact location — same words use karo baar baar same location ke liye]
mood: [ek word — Daravna/Suspenseful/Intense/Creepy/Shocking]
what: [kya hua — 1 line Hindi mein]
prev_connect: [pichle scene se kya connect hai — 1 line]
imgprompt: [English — 2D horror cel-shaded animation style, dark atmospheric. Include: exact location details matching previous scenes, character full visual description from bible above, action/pose, lighting, color palette, camera angle. 60-80 words.]
SCENE_END

MINIMUM 20 scenes. Sirf format, koi extra text nahi.`
        }]
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const scenes = parseScenes(raw);

    if (!scenes.length) {
      if (out) out.innerHTML = '<div class="analysis-empty">Scenes parse nahi ho paye. Manually generate karo.</div>';
    } else {
      state.savedScenes = scenes;
      state.savedScenesEpId = state.currentEpId;
      save();
      saveCurrentEpisode(true);
      if (out) renderScenes(scenes);
      toast(`✅ ${scenes.length} scenes ready!`);
    }
  } catch (err) {
    if (out) out.innerHTML = `<div class="analysis-empty">Error: ${err.message}</div>`;
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Dobara Generate Karo'; }
}

async function generateScenes() {
  const btn = document.getElementById('genScenesBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Scenes generate ho rahe hain...'; }
  await generateScenesAuto();
}

function buildPollinationsUrl(prompt, seed) {
  const fullPrompt = prompt + ', cinematic realistic photography, dark horror atmosphere, dramatic lighting, ultra detailed, 4K, photorealistic';
  const encoded = encodeURIComponent(fullPrompt);
  const s = seed || Math.floor(Math.random()*99999);
  return 'https://image.pollinations.ai/prompt/' + encoded + '?width=768&height=432&seed=' + s + '&nologo=true&enhance=true&model=flux';
}

function renderScenes(scenes) {
  const out = document.getElementById('scenesOutput');
  if (!out) return;

  const totalScenes = scenes.length;
  const locations = [...new Set(scenes.map(s => s.location))].length;

  let html = '<div style="background:#0a0000;border:1px solid var(--blood-d);border-radius:8px;padding:12px;margin-bottom:4px;display:flex;gap:16px;flex-wrap:wrap;align-items:center;">'
    + '<span style="font-size:12px;color:var(--blood);">🎬 ' + totalScenes + ' Scenes</span>'
    + '<span style="font-size:12px;color:var(--bone-dim);">📍 ' + locations + ' Locations</span>'
    + '<span style="font-size:12px;color:var(--green);">🖼 Pollinations AI Images</span>'
    + '</div>';

  scenes.forEach(function(s, idx) {
    const safePrompt = (s.imgprompt || '').replace(/"/g, '&quot;');
    const imgId = 'scene-img-' + idx;
    html += '<div class="scene-card" data-imgprompt="' + safePrompt + '" data-idx="' + idx + '">'
      + '<div class="scene-num">🎬 Scene ' + s.num + ' <span style="color:#444;font-size:9px;letter-spacing:1px;">' + (s.mood||'').toUpperCase() + '</span></div>'
      + '<div class="scene-title">' + s.title + '</div>'
      + '<div class="scene-meta"><span class="scene-tag">📍 ' + s.location + '</span></div>'
      + '<div class="scene-desc">' + s.what + '</div>'
      + (s.prev_connect ? '<div style="font-size:11px;color:#555;margin-top:4px;font-style:italic;">🔗 ' + s.prev_connect + '</div>' : '')
      + (s.imgprompt
        ? '<div style="display:flex;gap:8px;margin-top:10px;">'
          + '<button data-prompt="' + safePrompt + '" onclick="copyScenePrompt(this)" style="flex:1;padding:9px;background:#0a0000;border:1px solid #440000;color:#cc4444;border-radius:8px;font-size:12px;cursor:pointer;">📋 Prompt Copy</button>'
          + '<button data-prompt="' + safePrompt + '" onclick="openImgModal(this)" style="flex:1;padding:9px;background:#0a0015;border:1px dashed #440066;color:#cc88ff;border-radius:8px;font-size:12px;cursor:pointer;">🖼 Image Banao</button>'
          + '</div>'
        : '')
      + '</div>';
  });

  out.innerHTML = html;
  // No auto-load — user manually generates each image
}

function loadSceneImg(idx, prompt, seed) {
  const wrap = document.getElementById('scene-img-' + idx);
  const btn = document.getElementById('scene-img-btn-' + idx);
  if (!wrap) return;

  // Pollinations AI — free, no API key, no CORS issue
  const s = (seed !== undefined && seed !== null) ? seed : Math.floor(Math.random()*99999);
  const url = buildPollinationsUrl(prompt, s);

  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="opacity:0.6">⏳ Ban rahi hai...</span>'; }
  wrap.style.cssText = 'width:100%;border-radius:8px;overflow:hidden;background:#0a0000;border:1px solid var(--border);margin-top:8px;display:flex;align-items:center;justify-content:center;min-height:80px;';
  wrap.innerHTML = '<div style="font-size:11px;color:#444;padding:20px;text-align:center;">🎨 Image generate ho rahi hai...<br><span style="font-size:10px;color:#333;">10-20 sec</span></div>';

  const img = new Image();
  img.onload = function() {
    wrap.style.cssText = 'width:100%;border-radius:8px;overflow:hidden;background:#0a0000;border:1px solid var(--border);margin-top:8px;position:relative;display:block;';
    wrap.innerHTML = '<img src="' + url + '" style="width:100%;display:block;border-radius:8px;">'
      + '<a href="' + url + '" download="scene_' + (idx+1) + '.jpg" target="_blank" style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,0.7);border:1px solid #444;color:#ccc;padding:3px 8px;border-radius:4px;font-size:10px;text-decoration:none;">⬇️</a>';
    if (btn) { btn.innerHTML = '🔄 Dobara Generate Karo'; btn.disabled = false; btn.style.borderColor = '#443300'; btn.style.color = '#ffaa00'; }
  };
  let retryCount = 0;
  img.onerror = function() {
    if (retryCount < 2) {
      retryCount++;
      setTimeout(function() {
        const newUrl = buildPollinationsUrl(prompt, Math.floor(Math.random()*99999));
        img.src = newUrl;
      }, retryCount * 3000);
    } else {
      wrap.innerHTML = '';
      wrap.style.cssText = '';
      if (btn) { btn.innerHTML = '⚠️ Error — Retry Karo'; btn.disabled = false; btn.style.borderColor = '#cc4444'; btn.style.color = '#cc4444'; }
    }
  };
  img.src = url;
}

function reloadAllImages() {
  const scenes = state.savedScenes;
  if (!scenes) return;
  toast('🔄 Saari images reload ho rahi hain (thoda time lagega)...');
  scenes.forEach(function(s, idx) {
    if (s.imgprompt) {
      setTimeout(function() {
        loadSceneImg(idx, s.imgprompt, Math.floor(Math.random()*99999));
      }, idx * 4000);
    }
  });
}

function generateSceneImage(idx) {
  const scenes = state.savedScenes;
  if (!scenes || !scenes[idx]) return;
  const btn = document.getElementById('scene-img-btn-' + idx);
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin-right:6px;vertical-align:middle;"></div> Ban raha hai...'; }
  const wrap = document.getElementById('scene-img-' + idx);
  if (wrap) wrap.innerHTML = '';
  loadSceneImg(idx, scenes[idx].imgprompt, Math.floor(Math.random()*99999));
  // After load, hide button — handled in loadSceneImg via callback
  setTimeout(function() {
    if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Dobara Generate Karo'; }
  }, 8000);
}

function regenSceneImg(idx) {
  generateSceneImage(idx);
}

function copyScenePrompt(btn) {
  const card = btn.closest('.scene-card');
  const prompt = card ? card.getAttribute('data-imgprompt') : '';
  if (!prompt) { toast('Prompt nahi mila'); return; }
  navigator.clipboard.writeText(prompt).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Prompt Copy'; }, 2000);
  }).catch(function() { toast('Copy nahi hua'); });
}

function parseScenes(raw) {
  const scenes = [];
  const blocks = raw.split('SCENE_START').slice(1);
  for (const block of blocks) {
    const end = block.indexOf('SCENE_END');
    const text = end > -1 ? block.slice(0, end) : block;
    const get = (key) => {
      const match = text.match(new RegExp(key + ':\\s*([\\s\\S]+?)(?=\\n\\w+:|$)'));
      return match ? match[1].trim() : '';
    };
    const title = get('title');
    if (!title) continue;
    scenes.push({
      num: get('num') || scenes.length + 1,
      title,
      location: get('location') || '—',
      mood: get('mood') || '—',
      what: get('what') || '—',
      prev_connect: get('prev_connect') || '',
      imgprompt: get('imgprompt') || '',
    });
  }
  return scenes;
}

// ══ AUTO CHARACTER GENERATION (called after story ends) ══
async function generateCharactersAuto() {
  const btn = document.getElementById('genCharsBtn');
  const out = document.getElementById('charsOutput');
  if (!state.storyChunks.length) return;
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Auto-generating...'; }
  if (out) out.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>Characters identify ho rahe hain...</div>';

  const storyText = state.storyChunks.map(c => c.text).join('\n\n');
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano',
        messages: [{
          role: 'user',
          content: `Yeh Hindi horror story hai:\n\n${storyText}\n\nIs story mein jo bhi characters hain unki list banao. Har character ke liye EXACTLY yeh format use karo:\n\nCHAR_START\nname: Character ka naam\nrole: Protagonist / Antagonist / Supporting / Supernatural\ndescription: Kaisa dikhta/dikhti hai, uski personality (2-3 lines)\nappearance: Story mein pehli baar kab aaya/aayi (ek line)\nimgprompt: [English only] Detailed image generation prompt for THIS character only. cinematic realistic photography, dark horror. Describe: physical appearance (age, build, face, hair, eyes, skin), clothing, expression, pose, background hint. Make it detailed for consistent character art.\nCHAR_END\n\nSirf yeh format, koi extra text nahi.`
        }],
        max_tokens: 2000,
        temperature: 0.4,
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const chars = parseCharacters(raw);
    if (chars.length) {
      state.savedChars = chars;
      state.savedScenesEpId = state.currentEpId;
      save();
      saveCurrentEpisode(true);
      if (out) renderChars(chars);
      toast(`👤 ${chars.length} characters ready!`);
    }
  } catch (err) { /* silent fail */ }
  if (btn) { btn.disabled = false; btn.innerHTML = '🔄 Dobara Generate Karo'; }
}

async function generateCharacters() {
  const btn = document.getElementById('genCharsBtn');
  const out = document.getElementById('charsOutput');
  if (!state.storyChunks.length) { toast('⚠️ Story nahi hai abhi!'); return; }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Characters dhundhe ja rahe hain...';
  out.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>AI characters identify kar raha hai...</div>';

  const storyText = state.storyChunks.map(c => c.text).join('\n\n');

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano',
        messages: [{
          role: 'user',
          content: `Yeh Hindi horror story hai:\n\n${storyText}\n\nIs story mein jo bhi characters hain unki list banao. Har character ke liye EXACTLY yeh format use karo:\n\nCHAR_START\nname: Character ka naam\nrole: Protagonist / Antagonist / Supporting / Supernatural\ndescription: Kaisa dikhta/dikhti hai, uski personality (2-3 lines)\nappearance: Story mein pehli baar kab aaya/aayi (ek line)\nimgprompt: [English only] Detailed image generation prompt for THIS character only. cinematic realistic photography, dark horror. Describe: physical appearance (age, build, face, hair, eyes, skin), clothing, expression, pose, background hint. Make it detailed for consistent character art.\nCHAR_END\n\nSirf yeh format, koi extra text nahi.`
        }],
        max_tokens: 2000,
        temperature: 0.4,
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const chars = parseCharacters(raw);

    if (!chars.length) {
      out.innerHTML = '<div class="analysis-empty">Characters parse nahi ho paye. Dobara try karo.</div>';
    } else {
      state.savedChars = chars;
      state.savedScenesEpId = state.currentEpId;
      save();
      saveCurrentEpisode(true);
      renderChars(chars);
    }
  } catch (err) {
    out.innerHTML = `<div class="analysis-empty">Error: ${err.message}</div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '🔄 Dobara Generate Karo';
}

function renderChars(chars) {
  const out = document.getElementById('charsOutput');
  if (!out) return;
  const roleEmoji = { 'Protagonist': '🦸', 'Antagonist': '👿', 'Supporting': '👤', 'Supernatural': '👻' };
  const allDesc = chars.map(c => `${c.name} (${c.role}): ${c.imgprompt || c.description}`).join(' | ');
  const combinedPrompt = `Group illustration of all characters together in one frame, cinematic realistic photography, dark horror, dark atmospheric background. Characters: ${allDesc}. Each character labeled with their name below. Horror anime art style, detailed character design.`;

  out.innerHTML = `
    <div class="img-prompt-box" style="border-color:#8800cc33;background:#0d0015;">
      <div class="img-prompt-label" style="color:#cc88ff;">🎭 All Characters — Group Frame Prompt</div>
      <div class="img-prompt-text">${combinedPrompt}</div>
      <button class="img-copy-btn" onclick="copyPrompt(this, \`${combinedPrompt.replace(/`/g,"'")}\`)">📋 Copy All</button>
    </div>
    ${chars.map(c => `
    <div class="char-card">
      <div class="char-name">
        ${roleEmoji[c.role] || '👤'} ${c.name}
        <span class="char-role-badge">${c.role}</span>
      </div>
      <div class="char-desc">${c.description}</div>
      <div class="char-appear">📍 ${c.appearance}</div>
      ${c.imgprompt ? `
      <div class="img-prompt-box" style="background:#08000f;border-color:#3a0055;">
        <div class="img-prompt-label" style="color:#cc88ff;">🎨 Character Image Prompt</div>
        <div class="img-prompt-text">${c.imgprompt}</div>
        <button class="img-copy-btn" onclick="copyPrompt(this, \`${c.imgprompt.replace(/`/g,"'")}\`)">📋 Copy</button>
      </div>` : ''}
    </div>
    `).join('')}
  `;
}

function parseCharacters(raw) {
  const chars = [];
  const blocks = raw.split('CHAR_START').slice(1);
  for (const block of blocks) {
    const end = block.indexOf('CHAR_END');
    const text = end > -1 ? block.slice(0, end) : block;
    const get = (key) => {
      const match = text.match(new RegExp(key + ':\\s*([\\s\\S]+?)(?=\\n\\w+:|$)'));
      return match ? match[1].trim() : '';
    };
    const name = get('name');
    if (!name) continue;
    chars.push({
      name,
      role: get('role') || 'Supporting',
      description: get('description') || '—',
      appearance: get('appearance') || '—',
      imgprompt: get('imgprompt') || '',
    });
  }
  return chars;
}

function copyPrompt(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 2000);
  }).catch(() => {
    toast('❌ Copy nahi hua, manually select karo');
  });
}

// ══ SEASON BIBLE ══
async function generateSeasonBible() {
  const btn = document.getElementById('bibleBtn');
  const out = document.getElementById('bibleOutput');
  if (!state.storyChunks.length) return;

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Bible ban raha hai...';
  out.style.display = 'block';
  out.innerHTML = '⏳ AI poori season analyze kar raha hai...';

  const storyText = state.storyChunks.map(c => c.text).join('\n\n');

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano',
        messages: [{
          role: 'user',
          content: `Yeh ${state.season} ki horror story hai titled "${state.title}":\n\n${storyText}\n\nIs story ka ek detailed SEASON BIBLE banao jo next season ke writer ko diya jayega taaki story consistent rahe. Include:\n\n1. CHARACTERS: Har character ka naam, appearance, personality, story mein unka role, kya hua unke saath\n2. MAIN PLOT: Season ki main story kya thi, major events\n3. UNRESOLVED MYSTERIES: Jo raaz abhi bhi baaki hain\n4. CLIFFHANGER: Season ka ending cliffhanger kya tha\n5. WORLD RULES: Is horror universe ke rules (ghost ke powers, location details, etc)\n6. NEXT SEASON HOOKS: Kya hona chahiye next season mein\n\nHindi mein likho. Detailed aur specific raho.`
        }],
        max_tokens: 1500,
        temperature: 0.3,
      })
    });
    const data = await res.json();
    const bible = data.choices?.[0]?.message?.content || '';
    if (bible) {
      state.seasonBible = bible;
      save();
      saveCurrentEpisode(true);
      out.innerHTML = bible.replace(/\n/g, '<br>');
      toast('📖 Season Bible ready! Next season mein use hoga.');
    }
  } catch (err) {
    out.innerHTML = `❌ Error: ${err.message}`;
  }
  btn.disabled = false;
  btn.innerHTML = '📖 Season Bible Banao';
}

async function startNextSeason() {
  const prevBible = state.seasonBible;
  if (!prevBible) { toast('⚠️ Pehle Season Bible banao!'); return; }

  const seasonMatch = state.season.match(/(\d+)/);
  const nextNum = seasonMatch ? parseInt(seasonMatch[1]) + 1 : 2;

  state.season = `SEASON ${nextNum}`;
  state.epNum = 'EP 01';
  state.storyChunks = [];
  state.storyEnded = false;
  state.currentEpId = null;
  state.savedScenes = null;
  state.savedChars = null;
  state.linkedSeasonId = state.currentEpId;
  // seasonBible stays for continuity

  save();
  showScreen('screenSetup');
  restoreSetupForm();
  await renderLinkSeasonBlock();
  toast(`🎬 Season ${nextNum} ready! Bible linked.`);
}

async function renderLinkSeasonBlock() {
  const block = document.getElementById('linkSeasonBlock');
  const list = document.getElementById('linkSeasonList');

  if (state.linkedSeasonId && state.seasonBible) {
    block.style.display = 'block';
    const eps = await getEpisodes();
    const linked = eps.find(e => e.id === state.linkedSeasonId);
    list.innerHTML = linked
      ? `<div style="font-size:12px;color:var(--green);padding:8px 0;">✅ Linked: ${linked.season} — "${linked.title}"</div>`
      : `<div style="font-size:12px;color:var(--bone-dim);">Linked season</div>`;
  } else {
    block.style.display = 'none';
  }
}

function clearLinkedSeason() {
  state.linkedSeasonId = null;
  state.seasonBible = null;
  save();
  renderLinkSeasonBlock();
  toast('🔗 Season link hata diya');
}

// ══ SCROLL ══
function scrollToBottom() {
  const area = document.getElementById('storyArea');
  area.scrollTop = area.scrollHeight;
}

document.getElementById('storyArea').addEventListener('scroll', function () {
  const fab = document.getElementById('scrollFab');
  const diff = this.scrollHeight - this.scrollTop - this.clientHeight;
  fab.classList.toggle('visible', diff > 200);
});

// ══ SAVE EPISODE ══
async function saveCurrentEpisode(silent = false) {
  if (!state.storyChunks.length) return;
  const fullStory = state.storyChunks.map(c => c.text).join('\n\n');
  const wc = fullStory.split(/\s+/).length;
  const ep = {
    id: state.currentEpId || Date.now().toString(),
    epNum: state.epNum,
    season: state.season,
    title: state.title,
    channel: state.channel,
    wordCount: wc,
    chunks: state.storyChunks.length,
    ended: state.storyEnded,
    savedAt: Date.now(),
    story: fullStory,
    prompt: state.prompt,
    seasonBible: state.seasonBible || null,
    linkedSeasonId: state.linkedSeasonId || null,
    savedScenes: state.savedScenes || null,
    savedChars: state.savedChars || null,
    savedNarration: state.savedNarration || null,
  };
  await window.db_saveEpisode(ep);
  if (!silent) toast('💾 Episode saved!');
}

async function renderSetupEpList() {
  const eps = (await getEpisodes()).slice().reverse();
  const list = document.getElementById('setupEpList');
  const badge = document.getElementById('epCountBadge');
  badge.textContent = eps.length ? eps.length + ' stories' : '';

  if (!eps.length) {
    list.innerHTML = '<div class="ep-empty">Koi story save nahi hua abhi</div>';
    return;
  }

  // Group by title
  const groups = {};
  eps.forEach(ep => {
    const key = ep.title || 'Untitled';
    if (!groups[key]) groups[key] = [];
    groups[key].push(ep);
  });

  list.innerHTML = Object.entries(groups).map(([title, epList]) => {
    const seasons = [...new Set(epList.map(e => e.season))].join(', ');
    const totalEps = epList.length;
    const latest = epList[0];
    const allDone = epList.every(e => e.ended);
    return `
      <div class="story-card" onclick="loadEpisode('${latest.id}')">
        <div class="story-card-title">${title}</div>
        <div class="story-card-meta">
          <span class="scene-tag">${seasons}</span>
          <span class="scene-tag">${totalEps} episode${totalEps > 1 ? 's' : ''}</span>
          <span class="scene-tag">${allDone ? '✅ Complete' : '🔄 Ongoing'}</span>
        </div>
        <div class="story-card-words">${latest.wordCount} words · Last: ${latest.epNum}</div>
        <button class="ep-row-del" onclick="deleteStory(event,'${title}')">🗑</button>
      </div>
    `;
  }).join('');
}

async function loadEpisode(id) {
  const eps = await getEpisodes();
  const ep = eps.find(e => e.id === id);
  if (!ep) return;

  state.currentEpId = id;
  state.epNum = ep.epNum;
  state.season = ep.season;
  state.title = ep.title;
  state.channel = ep.channel;
  state.prompt = ep.prompt || '';
  state.storyChunks = ep.story
    ? ep.story.split('\n\n').filter(Boolean).map(t => ({ text: t }))
    : [];
  state.storyEnded = ep.ended || false;
  state.seasonBible = ep.seasonBible || null;
  state.linkedSeasonId = ep.linkedSeasonId || null;
  state.savedScenes = ep.savedScenes || null;
  state.savedChars = ep.savedChars || null;
  state.savedNarration = ep.savedNarration || null;
  save();

  // Rebuild story area
  document.getElementById('storyArea').innerHTML = '';
  state.storyChunks.forEach((chunk, i) => {
    const el = createChunkEl(i + 1);
    el.querySelector('.chunk-text').textContent = chunk.text;
    // Note: image prompts not cached, copy button stays hidden on reload
  });
  wordCount = state.storyChunks.reduce((a, c) => a + c.text.split(/\s+/).length, 0);
  updateWordCount();

  if (state.storyEnded) {
    document.getElementById('endBanner').classList.add('show');
    document.getElementById('endBannerSub').textContent = `${state.season} · ${state.epNum} complete!`;
    setBtnsLoading(false);
    document.getElementById('continueBtn').disabled = true;
    document.getElementById('continueBtn').innerHTML = '✅ Episode Khatam';
  } else {
    document.getElementById('endBanner').classList.remove('show');
    document.getElementById('continueBtn').disabled = false;
    document.getElementById('continueBtn').innerHTML = '<span>📖 Continue Karo</span>';
  }

  _updateTopbar();
  showScreen('screenStory');
}

async function deleteStory(e, title) {
  e.stopPropagation();
  await window.db_deleteByTitle(title);
  renderSetupEpList();
  toast('🗑 Story deleted');
}

async function deleteEpisode(e, id) {
  e.stopPropagation();
  await window.db_deleteEpisode(id);
  if (state.currentEpId === id) state.currentEpId = null;
  renderSetupEpList();
  toast('🗑 Episode deleted');
}

// ══ THUMBNAIL PROMPT ══
let thumbStyle = 'cinematic';
let thumbPlat = 'YouTube thumbnail 16:9, 1280x720';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#thumbStyleChips .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#thumbStyleChips .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      thumbStyle = c.dataset.s;
    });
  });
  document.querySelectorAll('#thumbPlatChips .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#thumbPlatChips .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      thumbPlat = c.dataset.p;
    });
  });
});

const styleDesc = {
  cinematic: 'cinematic horror film style, dramatic lighting, high contrast, movie poster quality, photorealistic',
  anime: 'horror anime style, detailed cel-shaded illustration, dark fantasy, expressive characters, Japanese horror aesthetic',
  realistic: 'ultra realistic, hyper detailed, 8K, professional photography, horror atmosphere, dramatic shadows',
  cartoon: '2D cartoon animation style, bold outlines, cel-shaded, vibrant colors with dark horror theme, stylized characters',
  painting: 'dark oil painting style, gothic art, textured brushwork, chiaroscuro lighting, masterpiece quality',
};

function regenThumbnail(prompt) {
  const wrap = document.getElementById('thumbImgWrap');
  if (!wrap) return;
  const seed = Math.floor(Math.random() * 99999);
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=1280&height=720&seed=' + seed + '&nologo=true&enhance=true&model=flux';
  wrap.innerHTML = '<div style="font-size:11px;color:#444;padding:20px;text-align:center;">🎨 Naya thumbnail ban raha hai...</div>';
  const img = new Image();
  img.onload = function() {
    wrap.innerHTML = '<img src="' + url + '" style="width:100%;display:block;border-radius:8px;">'
      + '<a href="' + url + '" download="thumbnail.jpg" target="_blank" style="display:block;text-align:center;margin-top:6px;background:rgba(0,0,0,0.7);border:1px solid #444;color:#ccc;padding:5px;border-radius:4px;font-size:11px;text-decoration:none;">⬇️ Download Thumbnail</a>';
  };
  img.onerror = function() {
    wrap.innerHTML = '<div style="padding:16px;text-align:center;font-size:11px;color:#cc4444;">❌ Error — Dobara try karo</div>';
  };
  img.src = url;
}

async function generateThumbPrompt() {
  const btn = document.getElementById('genThumbBtn');
  const out = document.getElementById('thumbPromptOut');
  if (!state.storyChunks.length) { toast('⚠️ Pehle story likho!'); return; }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Prompt ban raha hai...';
  out.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>AI story padh raha hai...</div>';

  const storyText = state.storyChunks.map(c => c.text).join('\n\n');
  const style = styleDesc[thumbStyle] || styleDesc.cinematic;

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano',
        messages: [{
          role: 'user',
          content: `Yeh Hindi horror story hai:\nTitle: ${state.title}\nEpisode: ${state.epNum} | ${state.season}\n\nStory:\n${storyText}\n\nIs story ke liye ek YouTube thumbnail image generation prompt banao.\n\nRequirements:\n- Style: ${style}\n- Platform: ${thumbPlat}\n- Story ka sabse scary / dramatic moment capture karo\n- Main character ya scary element prominently dikhao\n- Dark, moody atmosphere\n- Include text overlay suggestion: title aur tagline kahan hoga\n- Colors jo horror feel dein\n- Specific composition details (foreground, background, lighting direction)\n\nSirf English mein prompt do. No extra explanation. Just the prompt, ready to paste in Midjourney/DALL-E/Stable Diffusion.`
        }],
        max_tokens: 400,
        temperature: 0.7,
      })
    });
    const data = await res.json();
    const prompt = data.choices?.[0]?.message?.content?.trim() || '';

    if (!prompt) {
      out.innerHTML = '<div class="analysis-empty">Prompt generate nahi hua. Dobara try karo.</div>';
    } else {
      // Auto copy to clipboard
      navigator.clipboard.writeText(prompt).catch(function(){});

      out.innerHTML = `
        <div class="img-prompt-box" style="background:#050010;border-color:#330066;">
          <div class="img-prompt-label" style="color:#aa66ff;">🖼 ${state.epNum} · ${state.title}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            <span class="scene-tag">${thumbStyle}</span>
            <span class="scene-tag">${thumbPlat.split(',')[0]}</span>
          </div>
          <div class="img-prompt-text">${prompt}</div>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            <button id="thumbCopyBtn" class="img-copy-btn" onclick="copyThumbPrompt(this, this.closest('.img-prompt-box').querySelector('.img-prompt-text').textContent)" style="border-color:#aa66ff;color:#aa66ff;flex:1;">📋 Prompt Copy Karo</button>
            <button class="img-copy-btn" onclick="openThumbModal(this.closest('.img-prompt-box').querySelector('.img-prompt-text').textContent)" style="border-color:#cc88ff;color:#cc88ff;flex:1;">🖼 Image Banao</button>
          </div>
          <div style="font-size:10px;color:#44bb66;margin-top:8px;">✅ Prompt auto-copied to clipboard!</div>
        </div>
        <button class="btn btn-ghost" onclick="generateThumbPrompt()" style="font-size:12px;margin-top:8px;">🔄 Alag Style Try Karo</button>
      `;
      // Mark thumbnail as generated
      if (window._ytSetStatus) { _ytSetStatus('thumbnail', true); updateYtStatusBadge(); }
    }

    } catch (err) {
    out.innerHTML = `<div class="analysis-empty">Error: ${err.message}</div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '✨ AI se Prompt Generate Karo';
}

// ══ FULL NARRATION GENERATOR (ElevenLabs Ready) ══
function renderNarration(narration, textEl) {
  textEl.innerHTML = narration
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;break time="([^"]+)" \/&gt;/g, '<span style="background:#1a0033;color:#cc88ff;padding:1px 6px;border-radius:3px;font-size:11px;font-family:monospace;">&lt;break time="$1" /&gt;</span>');
}

async function generateFullNarration(forceRegenerate = false) {
  if (!state.storyChunks.length) { toast('⚠️ Story nahi hai!'); return; }

  const out = document.getElementById('narrationOutput');
  const textEl = document.getElementById('narrationText');
  out.style.display = 'block';

  // Agar already saved hai aur force regenerate nahi hai toh seedha dikhao
  if (state.savedNarration && !forceRegenerate) {
    renderNarration(state.savedNarration, textEl);
    // Show regenerate button
    const regenBtn = document.getElementById('regenNarrationBtn');
    if (regenBtn) regenBtn.style.display = 'inline-flex';
    out.scrollIntoView({ behavior: 'smooth' });
    toast('✅ Saved narration load ho gayi!');
    return;
  }

  textEl.textContent = '';
  textEl.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>ElevenLabs narration ban rahi hai...</div>';

  const fullStory = state.storyChunks.map(c => c.text).join('\n\n');

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano',
        max_tokens: 2500,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `Tu ek professional Hindi horror story narrator hai jo ElevenLabs text-to-speech ke liye voice-over script likhta hai.

ElevenLabs ke liye yeh special tags use karna ZAROORI hai:
- <break time="0.5s" /> — chhota pause
- <break time="1.0s" /> — dramatic pause
- <break time="1.5s" /> — lamba suspense pause
- <break time="2.0s" /> — climax ke liye maximum pause

SIRF HINDI DEVANAGARI mein likho. Sirf ElevenLabs break tags allowed hain.`
          },
          {
            role: 'user',
            content: `Yeh horror story hai:\n\n${fullStory}\n\nAb is poori story ka ElevenLabs-ready HINDI NARRATION script likho.\n\nZARRORI RULES:\n- SIRF HINDI DEVANAGARI mein likho — ek bhi English word nahi (sirf break tags allowed)\n- Poori story ek flow mein — koi "Part 1, Part 2" nahi\n- Har scary/tense moment ke baad <break time="1.0s" /> lagao\n- Dialogue se pehle aur baad mein <break time="0.5s" /> lagao\n- Climax ya twist ke baad <break time="1.5s" /> lagao\n- Story ke bilkul shuru mein <break time="0.8s" /> lagao\n- Koi heading mat lagao, seedha narration shuru karo\n\nExample:\nRaat ke do baj rahe the... <break time="1.0s" /> jab Ramesh ne woh awaaz suni. <break time="0.8s" /> "Kaun hai wahan?" <break time="0.5s" /> usne kaanpte huye pucha. <break time="1.5s" />\n\nAb poori story is style mein likho:`
          }
        ]
      })
    });

    const data = await res.json();
    const narration = data.choices?.[0]?.message?.content?.trim() || '';

    if (narration) {
      state.savedNarration = narration;
      save();
      saveCurrentEpisode(true);
      renderNarration(narration, textEl);
      const regenBtn = document.getElementById('regenNarrationBtn');
      if (regenBtn) regenBtn.style.display = 'inline-flex';
      toast('✅ ElevenLabs Narration ready!');
      out.scrollIntoView({ behavior: 'smooth' });
    } else {
      textEl.textContent = 'Narration generate nahi hua. Dobara try karo.';
    }
  } catch (err) {
    textEl.textContent = '❌ Error: ' + err.message;
  }
}

function copyNarration() {
  // Seedha savedNarration se copy karo — ElevenLabs tags intact rahenge
  const text = state.savedNarration || '';
  if (!text.trim()) { toast('❌ Pehle narration generate karo!'); return; }
  navigator.clipboard.writeText(text).then(() => {
    toast('✅ ElevenLabs Narration copied!');
  }).catch(() => toast('❌ Copy nahi hua'));
}
