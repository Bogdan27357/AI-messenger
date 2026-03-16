const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Jamendo API (free full-length tracks)
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || 'dad70181';

async function jamendoFetch(endpoint) {
  const url = `https://api.jamendo.com/v3.0${endpoint}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.headers && data.headers.status === 'error') {
    throw new Error(data.headers.error_message || 'Jamendo API error');
  }
  return data;
}

function normalizeTracks(tracks) {
  return (tracks || []).filter(t => t.audio).map(t => ({
    id: t.id,
    name: t.name,
    artist_name: t.artist_name,
    album_image: t.album_image || t.image || '',
    audio: t.audio,
    duration: t.duration,
    genre: t.musicinfo?.tags?.genres?.[0] || ''
  }));
}

// Search tracks
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || 'popular';
    const data = await jamendoFetch(`/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=25&search=${encodeURIComponent(query)}&include=musicinfo&audioformat=mp32`);
    res.json({ results: normalizeTracks(data.results) });
  } catch (err) {
    console.error('Jamendo search error:', err.message);
    res.status(500).json({ error: err.message, results: [] });
  }
});

// Popular tracks
app.get('/api/tracks/popular', async (req, res) => {
  try {
    const data = await jamendoFetch(`/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=30&order=popularity_total&include=musicinfo&audioformat=mp32`);
    res.json({ results: normalizeTracks(data.results) });
  } catch (err) {
    console.error('Jamendo popular error:', err.message);
    res.status(500).json({ error: err.message, results: [] });
  }
});

// Tracks by genre/tag
app.get('/api/tracks/bygenre', async (req, res) => {
  try {
    const genre = req.query.genre || 'pop';
    const data = await jamendoFetch(`/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=25&tags=${encodeURIComponent(genre)}&include=musicinfo&audioformat=mp32&order=popularity_total`);
    res.json({ results: normalizeTracks(data.results) });
  } catch (err) {
    console.error('Jamendo genre error:', err.message);
    res.status(500).json({ error: err.message, results: [] });
  }
});

// AI recommendation via Ollama
app.post('/api/recommend', async (req, res) => {
  try {
    const { listeningHistory } = req.body;

    if (!listeningHistory || listeningHistory.length === 0) {
      return res.json({
        recommendation: 'Начните слушать музыку, и я смогу предложить вам треки на основе ваших предпочтений!',
        searchQueries: ['popular', 'chill', 'electronic']
      });
    }

    const historyText = listeningHistory
      .map(t => `"${t.name}" by ${t.artist_name}${t.genre ? ` (${t.genre})` : ''}`)
      .join('\n');

    const prompt = `You are a music recommendation AI assistant. Based on the user's listening history below, suggest what kind of music they might enjoy next.

Listening history:
${historyText}

Respond in Russian language. Provide:
1. A brief analysis of their music taste (2-3 sentences)
2. Exactly 3 search queries (single words or short phrases) that would help find similar music they'd enjoy

Format your response EXACTLY like this:
ANALYSIS: [your analysis here]
QUERIES: query1, query2, query3`;

    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: { temperature: 0.7 }
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama returned ${ollamaResponse.status}`);
    }

    const ollamaData = await ollamaResponse.json();
    const responseText = ollamaData.response || '';

    let analysis = 'Мне нравится ваш вкус в музыке! Вот что я рекомендую.';
    let searchQueries = ['chill', 'electronic', 'indie'];

    const analysisMatch = responseText.match(/ANALYSIS:\s*(.+?)(?=QUERIES:|$)/s);
    if (analysisMatch) {
      analysis = analysisMatch[1].trim();
    }

    const queriesMatch = responseText.match(/QUERIES:\s*(.+)/s);
    if (queriesMatch) {
      searchQueries = queriesMatch[1].split(',').map(q => q.trim()).filter(Boolean).slice(0, 3);
    }

    res.json({ recommendation: analysis, searchQueries });
  } catch (err) {
    console.error('Ollama error:', err.message);
    res.json({
      recommendation: 'ИИ-сервис временно недоступен. Убедитесь, что Ollama запущена (ollama serve). Показываю популярные треки.',
      searchQueries: ['popular', 'trending', 'best'],
      error: true
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎵 AI Music Recommender running at http://localhost:${PORT}`);
  console.log(`🤖 Ollama URL: ${OLLAMA_URL} (model: ${OLLAMA_MODEL})`);
  console.log(`🎶 Jamendo Client ID: ${JAMENDO_CLIENT_ID}`);
});
