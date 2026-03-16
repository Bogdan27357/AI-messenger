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

// Proxy to Jamendo API (free music service)
const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || 'b6747d04';

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || 'popular';
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=20&search=${encodeURIComponent(query)}&include=musicinfo&audiodlformat=mp32`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Jamendo API error:', err);
    res.status(500).json({ error: 'Failed to fetch music' });
  }
});

app.get('/api/tracks/popular', async (req, res) => {
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=30&order=popularity_total&include=musicinfo&audiodlformat=mp32`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Jamendo API error:', err);
    res.status(500).json({ error: 'Failed to fetch popular tracks' });
  }
});

app.get('/api/tracks/bygenre', async (req, res) => {
  try {
    const genre = req.query.genre || 'pop';
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=20&tags=${encodeURIComponent(genre)}&include=musicinfo&audiodlformat=mp32&order=popularity_total`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Jamendo API error:', err);
    res.status(500).json({ error: 'Failed to fetch tracks by genre' });
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
      .map(t => `"${t.name}" by ${t.artist_name} (genre: ${t.genre || 'unknown'})`)
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
});
