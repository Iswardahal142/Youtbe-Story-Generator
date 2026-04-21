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
  savedScenesEpId: null,
};

// ══ PERSIST — Firebase backed, localStorage fallback ══
async function load() {
  const d = await window.db_loadState();
  if (d) { state = { ...state, ...d }; }
}

function save() {
  window.db_saveState({ ...state });
}

// Episodes — async wrappers
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
  // YouTube fetched name ko priority do, phir saved state, phir blank
  const displayName = window.ytFetchedChannelName || state.channel || '';
  const inp = document.getElementById('cfgChannel');
  if (inp) {
    inp.value = displayName;
    inp.placeholder = displayName ? '' : 'Channel ID not set';
  }
  generatedTitle = '';
  generatedPrompt = '';
  document.getElementById('aiGenPreview').style.display = 'none';
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('genIdeaBtn').innerHTML = '✦ Generate Idea';
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
