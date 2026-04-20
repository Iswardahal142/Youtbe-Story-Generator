// ══ STATE ══
let state = {
  apiKey: '',
  channel: 'KAALI RAAT',
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
  document.getElementById('cfgChannel').value = state.channel || 'KAALI RAAT';
  generatedTitle = '';
  generatedPrompt = '';
  document.getElementById('aiGenPreview').style.display = 'none';
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('genIdeaBtn').innerHTML = '✨ AI se Story Idea Generate Karo';
  document.getElementById('genTitlePreview').textContent = '';
  renderLinkSeasonBlock();
}

// ══ GENRE CHIP ══
let selectedGenre = 'any';
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#genreChips .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#genreChips .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      selectedGenre = c.dataset.g;
    });
  });
});
