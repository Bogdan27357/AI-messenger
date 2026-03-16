// === State ===
const state = {
  currentTrack: null,
  playlist: [],
  playlistIndex: -1,
  isPlaying: false,
  listeningHistory: JSON.parse(localStorage.getItem('listeningHistory') || '[]')
};

// Pagination state for "Load more"
const pagination = {};

// === DOM Elements ===
const audio = document.getElementById('audio-player');
const playerBar = document.getElementById('player-bar');
const playerCover = document.getElementById('player-cover');
const playerTitle = document.getElementById('player-title');
const playerArtist = document.getElementById('player-artist');
const playerCurrent = document.getElementById('player-current');
const playerDuration = document.getElementById('player-duration');
const playerProgressBar = document.getElementById('player-progress-bar');
const playerProgress = document.getElementById('player-progress');
const btnPlay = document.getElementById('btn-play');
const playIcon = document.getElementById('play-icon');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const volumeSlider = document.getElementById('volume-slider');
const searchInput = document.getElementById('search-input');
const btnRecommend = document.getElementById('btn-recommend');

// === Init ===
audio.volume = 0.7;

document.addEventListener('DOMContentLoaded', () => {
  loadPopularTracks();
  loadGenreSection('electronic', 'electronic-tracks');
  loadGenreSection('rock', 'rock-tracks');
  loadGenreSection('jazz', 'jazz-tracks');
  renderHistory();
  setupNavigation();
  setupPlayer();
  setupSearch();
  setupGenres();
  setupAI();
});

// === Navigation ===
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      showPage(page);
    });
  });
}

function showPage(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-page="${name}"]`).classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
}

// === Jamendo API ===
async function loadPopularTracks() {
  try {
    const res = await fetch('/api/tracks/popular');
    const data = await res.json();
    if (data.results) {
      renderTrackGrid('popular-tracks', data.results);
      pagination['popular'] = { url: '/api/tracks/popular', offset: data.results.length, hasMore: data.hasMore, containerId: 'popular-tracks', mode: 'grid' };
      if (data.hasMore) addLoadMoreBtn('popular-tracks', 'popular');
    }
  } catch (err) {
    console.error('Failed to load popular tracks:', err);
  }
}

async function searchTracks(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.results) {
      renderTrackList('search-results', data.results);
      pagination['search'] = { url: `/api/search?q=${encodeURIComponent(query)}`, offset: data.results.length, hasMore: data.hasMore, containerId: 'search-results', mode: 'list' };
      if (data.hasMore) addLoadMoreBtn('search-results', 'search');
    }
  } catch (err) {
    console.error('Search failed:', err);
  }
}

async function loadGenreSection(genre, containerId) {
  try {
    const res = await fetch(`/api/tracks/bygenre?genre=${encodeURIComponent(genre)}`);
    const data = await res.json();
    if (data.results) {
      renderTrackGrid(containerId, data.results);
      const key = `genre_${containerId}`;
      pagination[key] = { url: `/api/tracks/bygenre?genre=${encodeURIComponent(genre)}`, offset: data.results.length, hasMore: data.hasMore, containerId, mode: 'grid' };
      if (data.hasMore) addLoadMoreBtn(containerId, key);
    }
  } catch (err) {
    console.error(`Failed to load ${genre}:`, err);
  }
}

async function loadByGenre(genre) {
  try {
    const res = await fetch(`/api/tracks/bygenre?genre=${encodeURIComponent(genre)}`);
    const data = await res.json();
    if (data.results) {
      showPage('search');
      renderTrackList('search-results', data.results);
      pagination['search'] = { url: `/api/tracks/bygenre?genre=${encodeURIComponent(genre)}`, offset: data.results.length, hasMore: data.hasMore, containerId: 'search-results', mode: 'list' };
      if (data.hasMore) addLoadMoreBtn('search-results', 'search');
    }
  } catch (err) {
    console.error('Genre load failed:', err);
  }
}

// === Load More ===
function addLoadMoreBtn(containerId, paginationKey) {
  const container = document.getElementById(containerId);
  const existing = container.parentElement.querySelector('.btn-load-more');
  if (existing) existing.remove();

  const btn = document.createElement('button');
  btn.className = 'btn-load-more';
  btn.textContent = 'Загрузить ещё';
  btn.dataset.paginationKey = paginationKey;
  container.parentElement.appendChild(btn);
}

document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('btn-load-more')) return;
  const key = e.target.dataset.paginationKey;
  const p = pagination[key];
  if (!p) return;
  loadMore(key, e.target);
});

async function loadMore(key, btn) {
  const p = pagination[key];
  if (!p || !p.hasMore) return;

  btn.disabled = true;
  btn.textContent = 'Загрузка...';

  try {
    const separator = p.url.includes('?') ? '&' : '?';
    const res = await fetch(`${p.url}${separator}offset=${p.offset}`);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      // Append new tracks to existing store
      const existing = trackStore[p.containerId] || [];
      const newTracks = [...existing, ...data.results];
      trackStore[p.containerId] = newTracks;

      // Re-render
      if (p.mode === 'grid') {
        appendTrackGrid(p.containerId, data.results, existing.length);
      } else {
        appendTrackList(p.containerId, data.results, existing.length);
      }

      // Update playlist if currently playing from this container
      if (state.playlist === existing) {
        state.playlist = newTracks;
      }

      p.offset += data.results.length;
      p.hasMore = data.hasMore;

      if (data.hasMore) {
        btn.disabled = false;
        btn.textContent = 'Загрузить ещё';
      } else {
        btn.remove();
      }
    } else {
      btn.remove();
    }
  } catch (err) {
    console.error('Load more error:', err);
    btn.disabled = false;
    btn.textContent = 'Загрузить ещё';
  }
}

// === Track data store ===
const trackStore = {};

// === Rendering ===
function renderTrackGrid(containerId, tracks) {
  const container = document.getElementById(containerId);
  trackStore[containerId] = tracks;
  container.innerHTML = tracks.map((track, i) => `
    <div class="track-card ${isCurrentTrack(track) ? 'playing' : ''}" data-container="${containerId}" data-index="${i}">
      <img class="track-card-cover" src="${track.album_image || ''}" alt="${escapeHtml(track.name)}" loading="lazy">
      <div class="track-card-title">${escapeHtml(track.name)}</div>
      <div class="track-card-artist">${escapeHtml(track.artist_name)}</div>
    </div>
  `).join('');
}

function appendTrackGrid(containerId, newTracks, startIndex) {
  const container = document.getElementById(containerId);
  const html = newTracks.map((track, i) => `
    <div class="track-card ${isCurrentTrack(track) ? 'playing' : ''}" data-container="${containerId}" data-index="${startIndex + i}">
      <img class="track-card-cover" src="${track.album_image || ''}" alt="${escapeHtml(track.name)}" loading="lazy">
      <div class="track-card-title">${escapeHtml(track.name)}</div>
      <div class="track-card-artist">${escapeHtml(track.artist_name)}</div>
    </div>
  `).join('');
  container.insertAdjacentHTML('beforeend', html);
}

function renderTrackList(containerId, tracks) {
  const container = document.getElementById(containerId);
  if (!tracks.length) {
    container.innerHTML = '<div class="empty-state"><p>Ничего не найдено</p></div>';
    return;
  }
  trackStore[containerId] = tracks;
  container.innerHTML = tracks.map((track, i) => `
    <div class="track-row ${isCurrentTrack(track) ? 'playing' : ''}" data-container="${containerId}" data-index="${i}">
      <div class="track-row-num">
        ${isCurrentTrack(track) && state.isPlaying ?
          '<div class="eq-bars"><span></span><span></span><span></span></div>' :
          (i + 1)}
      </div>
      <img class="track-row-cover" src="${track.album_image || ''}" alt="" loading="lazy">
      <div class="track-row-info">
        <div class="track-row-title">${escapeHtml(track.name)}</div>
        <div class="track-row-artist">${escapeHtml(track.artist_name)}</div>
      </div>
      <div class="track-row-duration">${formatTime(track.duration)}</div>
    </div>
  `).join('');
}

function appendTrackList(containerId, newTracks, startIndex) {
  const container = document.getElementById(containerId);
  const html = newTracks.map((track, i) => `
    <div class="track-row ${isCurrentTrack(track) ? 'playing' : ''}" data-container="${containerId}" data-index="${startIndex + i}">
      <div class="track-row-num">${startIndex + i + 1}</div>
      <img class="track-row-cover" src="${track.album_image || ''}" alt="" loading="lazy">
      <div class="track-row-info">
        <div class="track-row-title">${escapeHtml(track.name)}</div>
        <div class="track-row-artist">${escapeHtml(track.artist_name)}</div>
      </div>
      <div class="track-row-duration">${formatTime(track.duration)}</div>
    </div>
  `).join('');
  container.insertAdjacentHTML('beforeend', html);
}

// Event delegation for track clicks
document.addEventListener('click', (e) => {
  const card = e.target.closest('.track-card, .track-row');
  if (!card) return;
  const containerId = card.dataset.container;
  const index = parseInt(card.dataset.index, 10);
  const tracks = trackStore[containerId];
  if (tracks && !isNaN(index)) {
    playFromList(tracks, index);
  }
});

function isCurrentTrack(track) {
  return state.currentTrack && state.currentTrack.id === track.id;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// === Player ===
function setupPlayer() {
  btnPlay.addEventListener('click', togglePlay);
  btnPrev.addEventListener('click', playPrev);
  btnNext.addEventListener('click', playNext);

  volumeSlider.addEventListener('input', (e) => {
    audio.volume = e.target.value;
  });

  playerProgress.addEventListener('click', (e) => {
    const rect = playerProgress.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      playerProgressBar.style.width = pct + '%';
      playerCurrent.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    playerDuration.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('ended', () => {
    playNext();
  });

  audio.addEventListener('play', () => {
    state.isPlaying = true;
    updatePlayIcon();
  });

  audio.addEventListener('pause', () => {
    state.isPlaying = false;
    updatePlayIcon();
  });
}

function playTrack(track) {
  if (!track || !track.audio) return;

  state.currentTrack = track;
  audio.src = track.audio;
  audio.play();

  playerCover.src = track.album_image || track.image || '';
  playerTitle.textContent = track.name;
  playerArtist.textContent = track.artist_name;

  // Add to listening history
  addToHistory(track);

  // Update UI to show playing state
  updatePlayingState();
}

function playFromList(tracks, index) {
  state.playlist = tracks;
  state.playlistIndex = index;
  playTrack(tracks[index]);
}

function togglePlay() {
  if (!state.currentTrack) return;
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
}

function playNext() {
  if (state.playlist.length === 0) return;
  state.playlistIndex = (state.playlistIndex + 1) % state.playlist.length;
  playTrack(state.playlist[state.playlistIndex]);
}

function playPrev() {
  if (state.playlist.length === 0) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  state.playlistIndex = (state.playlistIndex - 1 + state.playlist.length) % state.playlist.length;
  playTrack(state.playlist[state.playlistIndex]);
}

function updatePlayIcon() {
  if (state.isPlaying) {
    playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  } else {
    playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
  }
}

function updatePlayingState() {
  document.querySelectorAll('.track-card, .track-row').forEach(el => {
    el.classList.remove('playing');
  });
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  seconds = Math.floor(seconds);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// === Search ===
function setupSearch() {
  let timeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(timeout);
    const q = searchInput.value.trim();
    if (q.length < 2) return;
    timeout = setTimeout(() => searchTracks(q), 400);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(timeout);
      const q = searchInput.value.trim();
      if (q) searchTracks(q);
    }
  });
}

// === Genres ===
function setupGenres() {
  document.querySelectorAll('.genre-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.querySelectorAll('.genre-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      loadByGenre(tag.dataset.genre);
    });
  });
}

// === Listening History ===
function addToHistory(track) {
  const entry = {
    id: track.id,
    name: track.name,
    artist_name: track.artist_name,
    album_image: track.album_image || track.image,
    audio: track.audio,
    duration: track.duration,
    genre: track.genre || '',
    timestamp: Date.now()
  };

  // Remove duplicate
  state.listeningHistory = state.listeningHistory.filter(t => t.id !== track.id);
  state.listeningHistory.unshift(entry);

  // Keep last 50
  if (state.listeningHistory.length > 50) {
    state.listeningHistory = state.listeningHistory.slice(0, 50);
  }

  localStorage.setItem('listeningHistory', JSON.stringify(state.listeningHistory));
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('history-tracks');
  const empty = document.getElementById('history-empty');

  if (state.listeningHistory.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  renderTrackList('history-tracks', state.listeningHistory);
}

// === AI Recommendations ===
function setupAI() {
  btnRecommend.addEventListener('click', getRecommendations);
}

async function getRecommendations() {
  btnRecommend.disabled = true;
  btnRecommend.classList.add('loading');
  btnRecommend.innerHTML = '<div class="spinner"></div> Анализирую...';

  const aiMessage = document.getElementById('ai-message');
  aiMessage.textContent = 'Подождите, ИИ анализирует вашу историю прослушиваний...';

  try {
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listeningHistory: state.listeningHistory.slice(0, 15)
      })
    });

    const data = await res.json();
    aiMessage.textContent = data.recommendation;

    // Load recommended tracks
    if (data.searchQueries && data.searchQueries.length > 0) {
      const allTracks = [];
      for (const query of data.searchQueries) {
        try {
          const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const searchData = await searchRes.json();
          if (searchData.results) {
            allTracks.push(...searchData.results);
          }
        } catch (e) {
          console.error('Failed to search for:', query);
        }
      }

      // Deduplicate and limit
      const seen = new Set();
      const unique = allTracks.filter(t => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      }).slice(0, 20);

      if (unique.length > 0) {
        const section = document.getElementById('ai-recommendations');
        section.style.display = 'block';
        renderTrackList('ai-tracks', unique);
      }
    }
  } catch (err) {
    aiMessage.textContent = 'Ошибка при получении рекомендаций. Проверьте, что Ollama запущена.';
    console.error('AI recommendation error:', err);
  }

  btnRecommend.disabled = false;
  btnRecommend.classList.remove('loading');
  btnRecommend.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
    Получить рекомендации
  `;
}
