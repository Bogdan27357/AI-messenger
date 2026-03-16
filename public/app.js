// === State ===
const state = {
  currentTrack: null,
  playlist: [],
  playlistIndex: -1,
  isPlaying: false,
  listeningHistory: JSON.parse(localStorage.getItem('listeningHistory') || '[]'),
  favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
  playlists: JSON.parse(localStorage.getItem('userPlaylists') || '[]'),
  shuffle: false,
  shuffledIndices: [],
  shufflePosition: -1,
  repeat: 'none', // none, all, one
  queue: [],
  currentPlaylistId: null // for playlist detail view
};

// Pagination state
const pagination = {};
// Track data store
const trackStore = {};

// SVG icons
const ICONS = {
  heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  queue: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  remove: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
};

// === DOM Elements ===
const audio = document.getElementById('audio-player');
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
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');
const btnFavCurrent = document.getElementById('btn-fav-current');
const btnQueue = document.getElementById('btn-queue');
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
  renderFavorites();
  renderPlaylists();
  renderSidebarPlaylists();
  setupNavigation();
  setupPlayer();
  setupSearch();
  setupGenres();
  setupAI();
  setupPlaylists();
  setupQueue();
});

// === Navigation ===
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });
}

function showPage(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.nav-btn[data-page="${name}"]`);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');

  // Reset playlist detail view when navigating to playlists
  if (name === 'playlists') {
    document.getElementById('playlists-view').style.display = '';
    document.getElementById('playlist-detail').style.display = 'none';
  }
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
      const existing = trackStore[p.containerId] || [];
      const newTracks = [...existing, ...data.results];
      trackStore[p.containerId] = newTracks;
      if (p.mode === 'grid') appendTrackGrid(p.containerId, data.results, existing.length);
      else appendTrackList(p.containerId, data.results, existing.length);
      if (state.playlist === existing) state.playlist = newTracks;
      p.offset += data.results.length;
      p.hasMore = data.hasMore;
      if (data.hasMore) { btn.disabled = false; btn.textContent = 'Загрузить ещё'; }
      else btn.remove();
    } else btn.remove();
  } catch (err) {
    console.error('Load more error:', err);
    btn.disabled = false;
    btn.textContent = 'Загрузить ещё';
  }
}

// === Track Action Buttons HTML ===
function trackActionsHtml(track) {
  const favClass = isFavorite(track.id) ? ' favorited' : '';
  return `<div class="track-row-actions">
    <button class="btn-track-action btn-fav${favClass}" data-action="fav" title="В избранное">${ICONS.heart}</button>
    <button class="btn-track-action" data-action="add-playlist" title="В плейлист">${ICONS.plus}</button>
    <button class="btn-track-action" data-action="add-queue" title="В очередь">${ICONS.queue}</button>
  </div>`;
}

function cardActionsHtml(track) {
  const favClass = isFavorite(track.id) ? ' favorited' : '';
  return `<div class="track-card-actions">
    <button class="btn-track-action btn-fav${favClass}" data-action="fav" title="В избранное">${ICONS.heart}</button>
    <button class="btn-track-action" data-action="add-playlist" title="В плейлист">${ICONS.plus}</button>
  </div>`;
}

// === Rendering ===
function renderTrackGrid(containerId, tracks) {
  const container = document.getElementById(containerId);
  trackStore[containerId] = tracks;
  container.innerHTML = tracks.map((track, i) => `
    <div class="track-card ${isCurrentTrack(track) ? 'playing' : ''}" data-container="${containerId}" data-index="${i}">
      ${cardActionsHtml(track)}
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
      ${cardActionsHtml(track)}
      <img class="track-card-cover" src="${track.album_image || ''}" alt="${escapeHtml(track.name)}" loading="lazy">
      <div class="track-card-title">${escapeHtml(track.name)}</div>
      <div class="track-card-artist">${escapeHtml(track.artist_name)}</div>
    </div>
  `).join('');
  container.insertAdjacentHTML('beforeend', html);
}

function renderTrackList(containerId, tracks, opts = {}) {
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
      ${trackActionsHtml(track)}
      ${opts.showRemove ? `<button class="btn-track-action" data-action="remove-from-playlist" data-track-id="${track.id}" title="Удалить">${ICONS.remove}</button>` : ''}
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
      ${trackActionsHtml(track)}
      <div class="track-row-duration">${formatTime(track.duration)}</div>
    </div>
  `).join('');
  container.insertAdjacentHTML('beforeend', html);
}

// === Event Delegation ===
document.addEventListener('click', (e) => {
  // Load more buttons
  if (e.target.classList.contains('btn-load-more')) {
    const key = e.target.dataset.paginationKey;
    if (pagination[key]) loadMore(key, e.target);
    return;
  }

  // Track action buttons
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    e.stopPropagation();
    const action = actionBtn.dataset.action;
    const row = actionBtn.closest('.track-card, .track-row');
    if (row) {
      const containerId = row.dataset.container;
      const index = parseInt(row.dataset.index, 10);
      const track = trackStore[containerId]?.[index];
      if (track) {
        if (action === 'fav') {
          toggleFavorite(track);
          actionBtn.classList.toggle('favorited');
          if (actionBtn.classList.contains('favorited')) actionBtn.querySelector('svg').setAttribute('fill', 'var(--pink)');
          else actionBtn.querySelector('svg').setAttribute('fill', 'none');
        } else if (action === 'add-playlist') {
          showPlaylistPicker(actionBtn, track);
        } else if (action === 'add-queue') {
          addToQueue(track);
        } else if (action === 'remove-from-playlist') {
          const trackId = actionBtn.dataset.trackId;
          if (state.currentPlaylistId) {
            removeTrackFromPlaylist(state.currentPlaylistId, trackId);
            renderPlaylistDetail(state.currentPlaylistId);
          }
        }
      }
    }
    return;
  }

  // Track click to play
  const card = e.target.closest('.track-card, .track-row');
  if (card && card.dataset.container) {
    const containerId = card.dataset.container;
    const index = parseInt(card.dataset.index, 10);
    const tracks = trackStore[containerId];
    if (tracks && !isNaN(index)) {
      playFromList([...tracks], index);
    }
  }

  // Close playlist picker on outside click
  const picker = document.getElementById('playlist-picker');
  if (picker.style.display !== 'none' && !e.target.closest('.playlist-picker') && !e.target.closest('[data-action="add-playlist"]')) {
    picker.style.display = 'none';
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
  btnShuffle.addEventListener('click', toggleShuffle);
  btnRepeat.addEventListener('click', cycleRepeat);
  btnFavCurrent.addEventListener('click', () => {
    if (state.currentTrack) {
      toggleFavorite(state.currentTrack);
      updateFavButton();
    }
  });

  volumeSlider.addEventListener('input', (e) => { audio.volume = e.target.value; });

  playerProgress.addEventListener('click', (e) => {
    const rect = playerProgress.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audio.duration) audio.currentTime = pct * audio.duration;
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      playerProgressBar.style.width = (audio.currentTime / audio.duration) * 100 + '%';
      playerCurrent.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    playerDuration.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('ended', () => {
    if (state.repeat === 'one') {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    playNext();
  });

  audio.addEventListener('play', () => { state.isPlaying = true; updatePlayIcon(); });
  audio.addEventListener('pause', () => { state.isPlaying = false; updatePlayIcon(); });
}

function playTrack(track) {
  if (!track || !track.audio) return;
  state.currentTrack = track;
  audio.src = track.audio;
  audio.play();
  const cover = track.album_image || track.image || '';
  if (cover) { playerCover.src = cover; playerCover.style.display = ''; }
  playerTitle.textContent = track.name;
  playerArtist.textContent = track.artist_name;
  addToHistory(track);
  updatePlayingState();
  updateFavButton();
  renderQueuePanel();
}

function playFromList(tracks, index) {
  state.playlist = tracks;
  state.playlistIndex = index;
  if (state.shuffle) generateShuffledIndices();
  playTrack(tracks[index]);
}

function togglePlay() {
  if (!state.currentTrack) return;
  if (audio.paused) audio.play();
  else audio.pause();
}

function playNext() {
  // Check queue first
  if (state.queue.length > 0) {
    const next = state.queue.shift();
    playTrack(next);
    renderQueuePanel();
    return;
  }

  if (state.playlist.length === 0) return;

  if (state.shuffle) {
    state.shufflePosition++;
    if (state.shufflePosition >= state.shuffledIndices.length) {
      if (state.repeat === 'none') { audio.pause(); return; }
      generateShuffledIndices();
      state.shufflePosition = 0;
    }
    state.playlistIndex = state.shuffledIndices[state.shufflePosition];
  } else {
    const nextIndex = state.playlistIndex + 1;
    if (nextIndex >= state.playlist.length) {
      if (state.repeat === 'none') { audio.pause(); return; }
      state.playlistIndex = 0;
    } else {
      state.playlistIndex = nextIndex;
    }
  }

  playTrack(state.playlist[state.playlistIndex]);
}

function playPrev() {
  if (state.playlist.length === 0) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }

  if (state.shuffle) {
    state.shufflePosition = Math.max(0, state.shufflePosition - 1);
    state.playlistIndex = state.shuffledIndices[state.shufflePosition];
  } else {
    state.playlistIndex = (state.playlistIndex - 1 + state.playlist.length) % state.playlist.length;
  }
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
  document.querySelectorAll('.track-card, .track-row').forEach(el => el.classList.remove('playing'));
}

function updateFavButton() {
  if (state.currentTrack && isFavorite(state.currentTrack.id)) {
    btnFavCurrent.classList.add('favorited');
  } else {
    btnFavCurrent.classList.remove('favorited');
  }
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  seconds = Math.floor(seconds);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// === Shuffle ===
function toggleShuffle() {
  state.shuffle = !state.shuffle;
  btnShuffle.classList.toggle('active', state.shuffle);
  if (state.shuffle && state.playlist.length > 0) generateShuffledIndices();
}

function generateShuffledIndices() {
  const indices = Array.from({ length: state.playlist.length }, (_, i) => i);
  // Fisher-Yates
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  // Put current track at position 0
  if (state.playlistIndex >= 0) {
    const ci = indices.indexOf(state.playlistIndex);
    if (ci > 0) [indices[0], indices[ci]] = [indices[ci], indices[0]];
  }
  state.shuffledIndices = indices;
  state.shufflePosition = 0;
}

// === Repeat ===
function cycleRepeat() {
  const modes = ['none', 'all', 'one'];
  const idx = (modes.indexOf(state.repeat) + 1) % modes.length;
  state.repeat = modes[idx];
  const badge = btnRepeat.querySelector('.repeat-badge');
  btnRepeat.classList.toggle('active', state.repeat !== 'none');
  badge.style.display = state.repeat === 'one' ? '' : 'none';
}

// === Queue ===
function setupQueue() {
  btnQueue.addEventListener('click', () => {
    const panel = document.getElementById('queue-panel');
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
    renderQueuePanel();
  });
  document.getElementById('queue-panel-close').addEventListener('click', () => {
    document.getElementById('queue-panel').style.display = 'none';
  });
}

function addToQueue(track) {
  state.queue.push({ ...track });
  renderQueuePanel();
}

function renderQueuePanel() {
  const nowPlaying = document.getElementById('queue-now-playing');
  const queueTracks = document.getElementById('queue-tracks');
  const queueEmpty = document.getElementById('queue-empty');

  if (state.currentTrack) {
    nowPlaying.innerHTML = `<div class="queue-track">
      <img src="${state.currentTrack.album_image || ''}" alt="">
      <div class="queue-track-info">
        <div class="queue-track-title">${escapeHtml(state.currentTrack.name)}</div>
        <div class="queue-track-artist">${escapeHtml(state.currentTrack.artist_name)}</div>
      </div>
    </div>`;
  } else {
    nowPlaying.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">—</p>';
  }

  if (state.queue.length === 0) {
    queueTracks.innerHTML = '';
    queueEmpty.style.display = '';
  } else {
    queueEmpty.style.display = 'none';
    queueTracks.innerHTML = state.queue.map((t, i) => `<div class="queue-track">
      <img src="${t.album_image || ''}" alt="">
      <div class="queue-track-info">
        <div class="queue-track-title">${escapeHtml(t.name)}</div>
        <div class="queue-track-artist">${escapeHtml(t.artist_name)}</div>
      </div>
      <button class="queue-track-remove" data-queue-index="${i}">${ICONS.remove}</button>
    </div>`).join('');
  }

  // Remove from queue handler
  queueTracks.querySelectorAll('.queue-track-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.queue.splice(parseInt(btn.dataset.queueIndex), 1);
      renderQueuePanel();
    });
  });
}

// === Favorites ===
function isFavorite(trackId) {
  return state.favorites.some(t => t.id === trackId);
}

function toggleFavorite(track) {
  if (isFavorite(track.id)) {
    state.favorites = state.favorites.filter(t => t.id !== track.id);
  } else {
    state.favorites.unshift({
      id: track.id, name: track.name, artist_name: track.artist_name,
      album_image: track.album_image || track.image, audio: track.audio,
      duration: track.duration, genre: track.genre || ''
    });
  }
  localStorage.setItem('favorites', JSON.stringify(state.favorites));
  renderFavorites();
}

function renderFavorites() {
  const container = document.getElementById('favorites-tracks');
  const empty = document.getElementById('favorites-empty');
  if (state.favorites.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
    renderTrackList('favorites-tracks', state.favorites);
  }
}

// === Playlists ===
function savePlaylists() {
  localStorage.setItem('userPlaylists', JSON.stringify(state.playlists));
}

function createPlaylist(name) {
  const pl = { id: 'pl_' + Date.now(), name: name || 'Новый плейлист', tracks: [] };
  state.playlists.unshift(pl);
  savePlaylists();
  renderPlaylists();
  renderSidebarPlaylists();
  return pl;
}

function renamePlaylist(id, name) {
  const pl = state.playlists.find(p => p.id === id);
  if (pl) { pl.name = name; savePlaylists(); renderPlaylists(); renderSidebarPlaylists(); }
}

function deletePlaylist(id) {
  state.playlists = state.playlists.filter(p => p.id !== id);
  savePlaylists();
  renderPlaylists();
  renderSidebarPlaylists();
}

function addTrackToPlaylist(playlistId, track) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  if (pl.tracks.some(t => t.id === track.id)) return; // no duplicates
  pl.tracks.push({
    id: track.id, name: track.name, artist_name: track.artist_name,
    album_image: track.album_image || track.image, audio: track.audio,
    duration: track.duration, genre: track.genre || ''
  });
  savePlaylists();
  renderSidebarPlaylists();
}

function removeTrackFromPlaylist(playlistId, trackId) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (pl) {
    pl.tracks = pl.tracks.filter(t => String(t.id) !== String(trackId));
    savePlaylists();
    renderSidebarPlaylists();
  }
}

function renderPlaylists() {
  const grid = document.getElementById('playlists-grid');
  const empty = document.getElementById('playlists-empty');
  if (state.playlists.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
    grid.innerHTML = state.playlists.map(pl => `
      <div class="playlist-card" data-playlist-id="${pl.id}">
        <div class="playlist-card-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </div>
        <div class="playlist-card-name">${escapeHtml(pl.name)}</div>
        <div class="playlist-card-count">${pl.tracks.length} треков</div>
      </div>
    `).join('');
  }
}

function renderPlaylistDetail(playlistId) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  state.currentPlaylistId = playlistId;
  document.getElementById('playlists-view').style.display = 'none';
  document.getElementById('playlist-detail').style.display = '';
  document.getElementById('playlist-detail-name').textContent = pl.name;
  document.getElementById('playlist-detail-count').textContent = `${pl.tracks.length} треков`;
  renderTrackList('playlist-detail-tracks', pl.tracks, { showRemove: true });
}

function renderSidebarPlaylists() {
  const list = document.getElementById('sidebar-playlists-list');
  list.innerHTML = state.playlists.map(pl =>
    `<button class="sidebar-playlist-item" data-sidebar-playlist="${pl.id}">${escapeHtml(pl.name)}</button>`
  ).join('');
}

function setupPlaylists() {
  document.getElementById('btn-create-playlist').addEventListener('click', () => {
    const name = prompt('Название плейлиста:');
    if (name && name.trim()) createPlaylist(name.trim());
  });

  document.getElementById('playlists-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.playlist-card');
    if (card) renderPlaylistDetail(card.dataset.playlistId);
  });

  document.getElementById('btn-playlist-back').addEventListener('click', () => {
    document.getElementById('playlists-view').style.display = '';
    document.getElementById('playlist-detail').style.display = 'none';
    state.currentPlaylistId = null;
    renderPlaylists();
  });

  document.getElementById('btn-play-all').addEventListener('click', () => {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    if (pl && pl.tracks.length > 0) playFromList([...pl.tracks], 0);
  });

  document.getElementById('btn-rename-playlist').addEventListener('click', () => {
    const pl = state.playlists.find(p => p.id === state.currentPlaylistId);
    if (!pl) return;
    const name = prompt('Новое название:', pl.name);
    if (name && name.trim()) {
      renamePlaylist(pl.id, name.trim());
      document.getElementById('playlist-detail-name').textContent = name.trim();
    }
  });

  document.getElementById('btn-delete-playlist').addEventListener('click', () => {
    if (confirm('Удалить плейлист?')) {
      deletePlaylist(state.currentPlaylistId);
      document.getElementById('playlists-view').style.display = '';
      document.getElementById('playlist-detail').style.display = 'none';
      state.currentPlaylistId = null;
    }
  });

  // Sidebar playlist click
  document.getElementById('sidebar-playlists-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sidebar-playlist]');
    if (btn) {
      showPage('playlists');
      renderPlaylistDetail(btn.dataset.sidebarPlaylist);
    }
  });

  // Playlist picker interactions
  document.getElementById('playlist-picker-new').addEventListener('click', () => {
    const name = prompt('Название плейлиста:');
    if (name && name.trim()) {
      const pl = createPlaylist(name.trim());
      if (state._pickerTrack) addTrackToPlaylist(pl.id, state._pickerTrack);
      document.getElementById('playlist-picker').style.display = 'none';
    }
  });
}

function showPlaylistPicker(anchorEl, track) {
  const picker = document.getElementById('playlist-picker');
  const items = document.getElementById('playlist-picker-items');
  state._pickerTrack = track;

  items.innerHTML = state.playlists.map(pl =>
    `<button class="playlist-picker-item" data-picker-playlist="${pl.id}">${escapeHtml(pl.name)}</button>`
  ).join('') || '<div style="padding:8px 16px;color:var(--text-secondary);font-size:13px">Нет плейлистов</div>';

  items.querySelectorAll('.playlist-picker-item').forEach(btn => {
    btn.addEventListener('click', () => {
      addTrackToPlaylist(btn.dataset.pickerPlaylist, track);
      picker.style.display = 'none';
    });
  });

  const rect = anchorEl.getBoundingClientRect();
  picker.style.display = '';
  picker.style.top = Math.min(rect.bottom + 4, window.innerHeight - picker.offsetHeight - 10) + 'px';
  picker.style.left = Math.min(rect.left, window.innerWidth - 240) + 'px';
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
    id: track.id, name: track.name, artist_name: track.artist_name,
    album_image: track.album_image || track.image, audio: track.audio,
    duration: track.duration, genre: track.genre || '', timestamp: Date.now()
  };
  state.listeningHistory = state.listeningHistory.filter(t => t.id !== track.id);
  state.listeningHistory.unshift(entry);
  if (state.listeningHistory.length > 50) state.listeningHistory = state.listeningHistory.slice(0, 50);
  localStorage.setItem('listeningHistory', JSON.stringify(state.listeningHistory));
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('history-tracks');
  const empty = document.getElementById('history-empty');
  if (state.listeningHistory.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
    renderTrackList('history-tracks', state.listeningHistory);
  }
}

// === AI Recommendations ===
function setupAI() {
  btnRecommend.addEventListener('click', getRecommendations);
}

async function getRecommendations() {
  btnRecommend.disabled = true;
  btnRecommend.innerHTML = '<div class="spinner"></div> Анализирую...';
  const aiMessage = document.getElementById('ai-message');
  aiMessage.textContent = 'Подождите, ИИ анализирует вашу историю прослушиваний...';

  try {
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listeningHistory: state.listeningHistory.slice(0, 15) })
    });
    const data = await res.json();
    aiMessage.textContent = data.recommendation;

    if (data.searchQueries && data.searchQueries.length > 0) {
      const allTracks = [];
      for (const query of data.searchQueries) {
        try {
          const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const searchData = await searchRes.json();
          if (searchData.results) allTracks.push(...searchData.results);
        } catch (e) { /* skip */ }
      }
      const seen = new Set();
      const unique = allTracks.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; }).slice(0, 20);
      if (unique.length > 0) {
        document.getElementById('ai-recommendations').style.display = 'block';
        renderTrackList('ai-tracks', unique);
      }
    }
  } catch (err) {
    aiMessage.textContent = 'Ошибка при получении рекомендаций. Проверьте, что Ollama запущена.';
  }

  btnRecommend.disabled = false;
  btnRecommend.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Получить рекомендации`;
}
