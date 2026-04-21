// ══ STATE ══
let state = {
  apiKey: '',
  channel: '',
  season: 'SEASON 1',
  epNum: 'EP 01',
  title: 'पुरानी हवेली का राज',
  prompt: '',
  storyChunks: [],
  storyEnded: false,
  thumbColor: '#cc0000',
  thumbBg: 'graveyard',
  currentEpId: null,
  seasonBible: null,
  linkedSeasonId: null,
  savedScenes: null,
  savedChars: null,
  characterBible: null,
  savedNarration: null,
  ytTitle: null,
  ytDesc: null,
  savedScenesEpId: null,
};

// ══ PERSIST ══
async function load() {
  const d = await window.db_loadState();
  if (d) {
    state = { ...state, ...d };
    // Purana hardcoded channel name clear karo
    if (state.channel === 'KAALI RAAT') state.channel = '';
    // Refresh ke baad bhi ytSelectedTitle restore ho
    if (state.ytTitle) window._ytSelectedTitle = state.ytTitle;
  }
}

function save() {
  window.db_saveState({ ...state });
}

async function getEpisodes() {
  return await window.db_getEpisodes();
}

// ══ SCREEN NAV ══
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s.id === id);
  });
  if (id === 'screenSetup') renderSetupEpList();
  if (id === 'screenStory') scrollToBottom();
}

function goToSetup() {
  saveCurrentEpisode(true);
  showScreen('screenSetup');
  restoreSetupForm();
}

function goToThumb() { showScreen('screenThumb'); }

function restoreSetupForm() {
  const inp = document.getElementById('cfgChannel');
  if (inp) {
    const name = window.ytFetchedChannelName || state.channel || '';
    inp.value = name;
    inp.placeholder = name ? '' : 'Channel ID not set';
  }
  generatedTitle = '';
  generatedPrompt = '';
  document.getElementById('aiGenPreview').style.display = 'none';
  document.getElementById('startBtn').style.display = 'none';
  const genBtn = document.getElementById('genIdeaBtn');
  if (genBtn) genBtn.innerHTML = '<span class="sg-gen-icon">✦</span> Generate Story Idea';
  document.getElementById('genTitlePreview').textContent = '';
  renderLinkSeasonBlock();
}

// ══ GENRE CHIP ══
let selectedGenre = 'any';
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#genreChips .sg-chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#genreChips .sg-chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      selectedGenre = c.dataset.g;
    });
  });
});
