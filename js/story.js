// ══ AI STORY IDEA GENERATOR ══
let generatedTitle = '';
let generatedPrompt = '';

// Track used story ideas to avoid repetition
async function getUsedIdeas() {
  return await window.db_getUsedIdeas();
}
async function saveUsedIdea(title) {
  const used = await getUsedIdeas();
  used.push(title);
  if (used.length > 50) used.shift();
  await window.db_saveUsedIdeas(used);
}

// ── Check: last episode uploaded hai? ──
async function _checkLastEpUploaded() {
  try {
    const eps = await window.db_getEpisodes();
    if (!eps || !eps.length) return true; // Pehli story — allow karo
    const last = eps[0];

    // YT functions available nahi — allow karo (YouTube setup nahi hua)
    if (!window._fetchYtVideos || !window._ytMatchScore) return true;

    let data;
    try { data = await window._fetchYtVideos(); }
    catch { return true; } // API fail = YouTube setup nahi, block mat karo

    const { videos } = data || {};
    if (!videos || !videos.length) return true; // No videos = channel empty, allow karo

    const matchTitle = last.ytTitle || (last.title || '').split(' | ')[1] || last.title || '';
    let best = 0;
    videos.forEach(v => {
      const s = window._ytMatchScore(matchTitle, v.title, v.description);
      if (s > best) best = s;
    });
    return best >= 40;
  } catch {
    return true; // Koi bhi unexpected error — allow karo, block mat karo
  }
}

async function generateAiStoryIdea() {
  const btn = document.getElementById('genIdeaBtn');

  // Block check — last episode uploaded nahi toh generate nahi
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Check ho raha hai...';
  const uploaded = await _checkLastEpUploaded();
  if (!uploaded) {
    // Button hide karo, warning message show karo
    btn.disabled = false;
    btn.innerHTML = '<span class="sg-gen-icon">✦</span> Generate Story Idea';
    const warn = document.getElementById('uploadWarningMsg');
    if (warn) { warn.style.display = 'block'; btn.style.display = 'none'; }
    return;
  }

  // Uploaded — warning hatao, button dikhao
  const warn = document.getElementById('uploadWarningMsg');
  if (warn) warn.style.display = 'none';
  btn.style.display = '';
  btn.disabled = false;
  btn.innerHTML = '<div class="spinner"></div> Soch raha hai...';

  const usedIdeas = await getUsedIdeas();
  const avoidList = usedIdeas.length
    ? `\n\nYeh titles AVOID karo (pehle generate ho chuke hain):\n${usedIdeas.slice(-20).join(', ')}`
    : '';

  const genreHint = selectedGenre !== 'any'
    ? `Setting/genre: ${selectedGenre}`
    : 'Koi bhi horror setting (haveli, jungle, highway, gaon, school, supernatural, psychological — kuch bhi)';

  // Top performing video ka context inject karo — trending niche pakadne ke liye
  const topVid = window._ytTopVideoContext;
  const topVideoHint = topVid
    ? `\n\nCHANNEL KA TOP PERFORMING VIDEO (Rank #1, ${topVid.viewCount.toLocaleString()} views):\nTitle: "${topVid.title}"\nDescription: "${topVid.description}"\n\nIs video ki THEME, SETTING aur STYLE se inspired story banao — same niche pakdo jo channel par already viral ho raha hai. Exact copy mat karo, lekin usi direction mein jao.`
    : '';

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        max_tokens: 400,
        temperature: 0.95,
        messages: [{
          role: 'user',
          content: `You are a Hindi horror story title generator. Generate a unique Hindi horror story.

Genre/Setting: ${genreHint}
${avoidList}${topVideoHint}

STRICT RULES:
- Title MUST be in Hindi Devanagari script only. Example: "अंधेरे का राज", "काली हवेली", "भूतों की वापसी"
- Title must be 3-6 Hindi words. NO English words in title.
- Plot: 3-4 sentences in Hindi Devanagari about the story setup.
- Both title and plot must be in Hindi Devanagari script only.

WRONG title: "The Horror Fair" or "Kaali Raat Ka Raaz"
RIGHT title: "काली रात का राज" or "भूतों का बदला" or "अंधेरी हवेली का सच"

Respond ONLY in this JSON format, no extra text:
{"title": "हिंदी शीर्षक यहाँ", "plot": "हिंदी में कहानी का विचार यहाँ"}`
        }]
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    generatedTitle = parsed.title || '';
    generatedPrompt = parsed.plot || '';

    // Check if title has Devanagari characters
    const hasDevanagari = /[ऀ-ॿ]/.test(generatedTitle);
    if (!hasDevanagari && generatedTitle) {
      // Title is not in Devanagari — auto retry once
      toast('🔄 Hindi mein convert ho raha hai...');
      const retryRes = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          max_tokens: 150,
          temperature: 0.5,
          messages: [{
            role: 'user',
            content: `Convert this story title to Hindi Devanagari script: "${generatedTitle}"
Also convert this plot summary to Hindi Devanagari: "${generatedPrompt}"

Respond ONLY in JSON: {"title": "देवनागरी शीर्षक", "plot": "देवनागरी में कहानी"}
No English. Pure Devanagari only.`
          }]
        })
      });
      const retryData = await retryRes.json();
      const retryRaw = retryData.choices?.[0]?.message?.content?.trim() || '';
      const retryClean = retryRaw.replace(/\`\`\`json|\`\`\`/g, '').trim();
      try {
        const retryParsed = JSON.parse(retryClean);
        if (retryParsed.title) generatedTitle = retryParsed.title;
        if (retryParsed.plot) generatedPrompt = retryParsed.plot;
      } catch(e) {}
    }

    if (generatedTitle && generatedPrompt) {
      // Main title (existing) | Generated YT title
      const mainTitle = state.title ? state.title.split(' | ')[0].trim() : '';
      const displayTitle = mainTitle ? mainTitle + ' | ' + generatedTitle : generatedTitle;
      document.getElementById('genTitlePreview').textContent = displayTitle;
      document.getElementById('aiGenPreview').style.display = 'block';
      document.getElementById('startBtn').style.display = 'flex';
      btn.innerHTML = '🔄 Dobara Generate Karo';
    } else {
      toast('⚠️ Idea generate nahi hua, dobara try karo');
      btn.innerHTML = '✨ AI se Story Idea Generate Karo';
    }
  } catch (err) {
    toast('❌ Error: ' + err.message);
    btn.innerHTML = '✨ AI se Story Idea Generate Karo';
  }
  btn.disabled = false;
}

// ══ IMAGE PROMPT GENERATOR FOR EACH PART ══
async function generatePartImagePrompt(chunkEl, storyText, partNum) {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano',
        max_tokens: 300,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: `Yeh Hindi horror story ka ek part hai (Part ${partNum}):\n\n${storyText}\n\nIs scene ke liye ek detailed image generation prompt banao.\n\nRequirements:\n- cinematic realistic photography, dark horror style\n- Is specific scene ka most dramatic/scary moment capture karo\n- Characters, location, lighting, colors describe karo\n- Dark, atmospheric horror mood\n- English mein prompt do\n- Sirf prompt text, koi explanation nahi, max 80 words`
        }]
      })
    });
    const data = await res.json();
    const imgPrompt = data.choices?.[0]?.message?.content?.trim() || '';
    if (imgPrompt) {
      const copyRow = chunkEl.querySelector('.chunk-copy-row');
      const copyBtn = chunkEl.querySelector('.chunk-img-copy-btn');
      if (copyRow && copyBtn) {
        copyRow.style.display = 'block';
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(imgPrompt).then(() => {
            copyBtn.textContent = '✅ Copied!';
            setTimeout(() => { copyBtn.textContent = '🖼 Image Prompt Copy Karo'; }, 2000);
          }).catch(() => toast('❌ Copy nahi hua'));
        };
      }
    }
  } catch (e) {
    // Silent fail — copy button stays hidden
  }
}

// ══ START ══
async function startStudio() {
  if (!generatedTitle) { toast('⚠️ Pehle AI se story idea generate karo!'); return; }

  state.channel = window.ytFetchedChannelName || document.getElementById('cfgChannel').value.trim() || '';
  // Main title prefix: agar pehle se koi story chal rahi hai toh uska base title lelo
  const _prevMain = state.currentEpId && state.title
    ? state.title.split(' | ')[0].trim()
    : '';
  state.title = _prevMain ? _prevMain + ' | ' + generatedTitle : generatedTitle;
  state.prompt = generatedPrompt;

  // Always start fresh at Season 1, EP 01 unless linked season
  if (!state.linkedSeasonId) {
    state.season = 'SEASON 1';
    state.epNum = 'EP 01';
    state.seasonBible = null;
  }

  state.storyChunks = [];
  state.storyEnded = false;
  state.currentEpId = Date.now().toString();
  state.savedScenes = null;
  state.savedChars = null;
  state.savedScenesEpId = null;
  state.characterBible = null;
  await saveUsedIdea(generatedTitle);
  save();

  _updateTopbar();
  document.getElementById('endBanner').classList.remove('show');
  document.getElementById('storyArea').innerHTML = '';
  updateWordCount();
  showScreen('screenStory');
  await sendContinue(true);
}

function _updateTopbar() {
  document.getElementById('topbarEp').textContent = `${state.season} · ${state.epNum} · ${state.title}`;
}

// Next Episode — same season, increment EP number
async function startNextEpisode() {
  // Parse current ep number and increment
  const epMatch = state.epNum.match(/(\d+)/);
  const nextEpNum = epMatch ? parseInt(epMatch[1]) + 1 : 2;
  const nextEpStr = 'EP ' + String(nextEpNum).padStart(2, '0');

  // Save previous episode context for continuity
  const prevStory = state.storyChunks.map(c => c.text).join('\n\n');
  const prevContext = `[${state.season} ${state.epNum} — "${state.title}" summary]:\n${prevStory.slice(0, 800)}...`;

  // Keep season bible + append ep context
  state.seasonBible = (state.seasonBible || '') + '\n\n' + prevContext;
  state.epNum = nextEpStr;
  state.storyChunks = [];
  state.storyEnded = false;
  state.currentEpId = Date.now().toString();
  state.savedScenes = null;
  state.savedChars = null;
  state.savedScenesEpId = null;
  state.characterBible = null;
  state.savedNarration = null;
  // Naye episode ke liye ytTitle/ytDesc reset
  state.ytTitle = null;
  state.ytDesc = null;
  state.title = state.title.split(' | ')[0].trim(); // Base title rakhlo
  window._ytSelectedTitle = null;
  save();

  _updateTopbar();
  document.getElementById('endBanner').classList.remove('show');
  document.getElementById('storyArea').innerHTML = '';
  updateWordCount();

  // Show ep divider
  const divider = document.createElement('div');
  divider.style.cssText = 'text-align:center;padding:12px;font-size:11px;letter-spacing:3px;color:var(--blood);text-transform:uppercase;';
  divider.textContent = `━━━ ${state.season} · ${nextEpStr} ━━━`;
  document.getElementById('storyArea').appendChild(divider);

  toast(`▶ ${nextEpStr} shuru ho raha hai...`);
  await sendContinue(true);
}
async function endCurrentSeason() {
  const sMatch = state.season.match(/(\d+)/);
  const nextSeasonNum = sMatch ? parseInt(sMatch[1]) + 1 : 2;
  const nextSeason = 'SEASON ' + nextSeasonNum;

  const prevStory = state.storyChunks.map(c => c.text).join('\n\n');
  const prevContext = `[${state.season} — "${state.title}" season summary]:\n${prevStory.slice(0, 1200)}...`;
  state.seasonBible = (state.seasonBible || '') + '\n\n' + prevContext;

  state.season  = nextSeason;
  state.epNum   = 'EP 01';
  state.storyChunks = [];
  state.storyEnded  = false;
  state.currentEpId = Date.now().toString();
  state.savedScenes = null;
  state.savedChars  = null;
  state.savedScenesEpId = null;
  state.characterBible  = null;
  state.savedNarration  = null;
  state.ytTitle = null;
  state.ytDesc  = null;
  state.title   = state.title.split(' | ')[0].trim();
  window._ytSelectedTitle = null;
  save();

  _updateTopbar();
  document.getElementById('endBanner').classList.remove('show');
  document.getElementById('storyArea').innerHTML = '';
  updateWordCount();

  const divider = document.createElement('div');
  divider.style.cssText = 'text-align:center;padding:16px;font-size:11px;letter-spacing:3px;color:#cc6600;text-transform:uppercase;';
  divider.textContent = `━━━ ${nextSeason} SHURU ━━━`;
  document.getElementById('storyArea').appendChild(divider);

  toast(`🏁 ${nextSeason} shuru ho raha hai!`);
}


// ══ STORY GENERATION ══
let isGenerating = false;
let wordCount = 0;
const TARGET_WORDS = 1500;

async function sendContinue(isFirst = false) {
  if (isGenerating || state.storyEnded) return;
  const hint = document.getElementById('promptInput').value.trim();

  isGenerating = true;
  setBtnsLoading(true);

  const systemPrompt = `You are a Hindi horror story writer. You MUST write ONLY in Hindi (Devanagari script). This is non-negotiable.

ABSOLUTE RULES — VIOLATING THESE IS NOT ALLOWED:
1. WRITE ONLY IN HINDI DEVANAGARI SCRIPT (हिंदी देवनागरी). Example: "रात का अंधेरा था।"
2. DO NOT write even a single sentence in English. NOT ONE.
3. Each part must be EXACTLY 100-120 Hindi words. No more, no less.
4. End every part on a cliffhanger or suspense hook.
5. Include sensory details — smells, sounds, touch, fear.
6. Do NOT end the story yourself — keep continuing until told "STORY END KARO".
7. Dialogues must also be in Hindi Devanagari only.

EMOTION TAGS — MANDATORY (ElevenLabs narration ke liye):
Sahi jagah pe yeh tags lagao text ke andar:
- [scared] → character darta hai, kaanpti awaaz
- [whisper] → dheere bolna, raaz ki baat  
- [laugh] → hasna (creepy bhi ho sakta hai)
- [cry] → rona, dard
- [angry] → gusse mein
- [shocked] → achanak kuch dekha/suna
- [calm] → normal narration (default)

Example: "[scared] उसके हाथ काँप रहे थे।" ya "[whisper] 'कोई है यहाँ?'"
Sirf dialogue aur emotional moments pe lagao, poore paragraphs pe nahi.${state.seasonBible ? `\n\nPREVIOUS SEASON CONTINUITY (MUST FOLLOW):\n${state.seasonBible}` : ''}\`;

  // Build conversation history
  const messages = [];
  const storyContext = state.storyChunks.map((c,i) => `[Part ${i+1}]:\n${c.text}`).join('\n\n');

  if (state.storyChunks.length === 0) {
    const userMsg = `केवल हिंदी देवनागरी लिपि में लिखो। अंग्रेज़ी का एक भी शब्द नहीं।\n\n${state.prompt ? 'कहानी का विचार: ' + state.prompt + '\n\n' : ''}पहला भाग लिखो — दृश्य तैयार करो, 1-2 पात्र introduce करो, रहस्य शुरू करो। सिर्फ 100-120 शब्द। हिंदी देवनागरी में।`;
    messages.push({ role: 'user', content: userMsg });
  } else {
    messages.push({
      role: 'user',
      content: `पिछली कहानी (हिंदी में है, इसी भाषा में जारी रखो):\n\n${storyContext}`
    });
    messages.push({
      role: 'assistant',
      content: '[कहानी जारी है...]'
    });
    let nextInstruction = `कहानी आगे बढ़ाओ। अगला भाग लिखो। सिर्फ हिंदी देवनागरी में। 100-120 words। Cliffhanger पर खत्म करो।`;
    if (hint) nextInstruction = `कहानी आगे बढ़ाओ। direction: "${hint}"। सिर्फ हिंदी देवनागरी में। 100-120 words। Cliffhanger पर खत्म करो।`;
    messages.push({ role: 'user', content: nextInstruction });
  }

  // Create chunk element with streaming
  const chunkEl = createChunkEl(state.storyChunks.length + 1);
  const textEl = chunkEl.querySelector('.chunk-text');
  const cursor = document.createElement('span');
  cursor.className = 'cursor-blink';
  textEl.appendChild(cursor);
  scrollToBottom();

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 400,
        temperature: 0.88,
        stream: true,
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            textEl.textContent = fullText;
            textEl.appendChild(cursor);
            scrollToBottom();
          }
        } catch {}
      }
    }

    cursor.remove();
    if (fullText.trim()) {
      state.storyChunks.push({ text: fullText.trim(), hint: hint || '' });
      wordCount = state.storyChunks.reduce((a,c) => a + c.text.split(/\s+/).length, 0);
      updateWordCount();
      save();
      document.getElementById('promptInput').value = '';
      // Generate image prompt for this part silently
      generatePartImagePrompt(chunkEl, fullText.trim(), state.storyChunks.length);
      // After first chunk, extract characters for consistency
      if (state.storyChunks.length === 1 && !state.characterBible) {
        extractCharacterBible(fullText.trim());
      }
    }

  } catch (err) {
    cursor.remove();
    textEl.textContent = '';
    chunkEl.remove();
    toast('❌ Error: ' + (err.message || 'API call fail hua'));
    console.error(err);
  }

  isGenerating = false;
  setBtnsLoading(false);
  scrollToBottom();
}

function createChunkEl(num) {
  const area = document.getElementById('storyArea');
  // Remove placeholder
  const placeholder = area.querySelector('div[style*="padding:40px"]');
  if (placeholder) placeholder.remove();

  const div = document.createElement('div');
  div.className = 'story-chunk';
  div.dataset.partNum = num;
  div.innerHTML = `
    <div class="chunk-meta">
      <span>📖</span>
      <span class="chunk-ep-label" style="font-size:10px;color:var(--blood);font-weight:700;letter-spacing:1px;">EP ${String(state.epNum.match(/\d+/)?.[0] || 1).padStart(2,'0')} · PART ${num}</span>
      <span style="margin-left:auto;font-size:10px;color:#333;">${num > 1 ? getTimeStamp() : ''}</span>
    </div>
    <div class="chunk-text"></div>
    <div class="chunk-copy-row" style="display:none;margin-top:10px;">
      <button class="img-copy-btn chunk-img-copy-btn" style="font-size:11px;padding:5px 12px;">🖼 Image Prompt Copy Karo</button>
    </div>
  `;
  area.appendChild(div);
  return div;
}

function getTimeStamp() {
  return new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
}

function updateWordCount() {
  const wc = state.storyChunks.reduce((a, c) => a + c.text.split(/\s+/).length, 0);
  const pct = Math.min(100, (wc / TARGET_WORDS) * 100);
  document.getElementById('wcFill').style.width = pct + '%';
  document.querySelector('.wc-label').textContent = wc + ' words';
  document.getElementById('wcTarget').textContent = '/ ~' + TARGET_WORDS;
}

function setBtnsLoading(loading) {
  const btn = document.getElementById('continueBtn');
  const sendBtn = document.getElementById('sendBtn');
  if (loading) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<div class="spinner"></div><span>Likh raha hai...</span>';
    sendBtn.disabled = true;
  } else {
    btn.disabled = state.storyEnded;
    btn.classList.remove('loading');
    btn.innerHTML = state.storyEnded ? '✅ Story Khatam' : '<span>📖 Continue Karo</span>';
    sendBtn.disabled = state.storyEnded;
  }
}

function setPromptHint(text) {
  document.getElementById('promptInput').value = text;
  document.getElementById('promptInput').focus();
}

async function endStoryNow() {
  if (isGenerating) return;
  isGenerating = true;
  setBtnsLoading(true);

  const systemPrompt = `You are a Hindi horror story writer. Write ONLY in Hindi Devanagari script (हिंदी देवनागरी). Do NOT write in English. Write the story ending in pure Hindi.`;
  const storyContext = state.storyChunks.map((c, i) => `[Part ${i+1}]:\n${c.text}`).join('\n\n');

  const chunkEl = createChunkEl(state.storyChunks.length + 1);
  const textEl = chunkEl.querySelector('.chunk-text');
  chunkEl.querySelector('.chunk-meta').innerHTML = '<span>🩸</span> The End';
  const cursor = document.createElement('span');
  cursor.className = 'cursor-blink';
  textEl.appendChild(cursor);

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `यह कहानी है:\n\n${storyContext}\n\nअब इस कहानी का एक powerful, scary ending हिंदी देवनागरी में लिखो। 100-120 words। "समाप्त" से खत्म करो। एक भी English sentence नहीं।`
          }
        ],
        max_tokens: 500,
        temperature: 0.85,
        stream: true,
      })
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            textEl.textContent = fullText;
            textEl.appendChild(cursor);
            scrollToBottom();
          }
        } catch {}
      }
    }
    cursor.remove();
    if (fullText.trim()) {
      state.storyChunks.push({ text: fullText.trim(), hint: 'END' });
      updateWordCount();
    }
  } catch (err) {
    cursor.remove();
    textEl.textContent = 'Story yahan khatam hoti hai... 🩸';
  }

  state.storyEnded = true;
  isGenerating = false;
  setBtnsLoading(false);
  document.getElementById('endBanner').classList.add('show');
  document.getElementById('endBannerSub').textContent = `${state.season} · ${state.epNum} complete!`;
  save();
  saveCurrentEpisode(true);
  scrollToBottom();
  // Auto-generate scenes + characters after story ends
  toast('🎬 Scenes & Characters auto-generate ho rahe hain...');
  setTimeout(async () => {
    await generateScenesAuto();
    await generateCharactersAuto();
  }, 1200);
}
