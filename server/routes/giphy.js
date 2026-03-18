const express = require('express');
const router = express.Router();

// Use Tenor API v2 (free tier, no key required for basic usage)
// Fallback: use a public GIPHY API key for demo purposes
const TENOR_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Public Tenor/Google key

// Search GIFs
router.get('/search', async (req, res) => {
  const q = req.query.q || '';
  const limit = parseInt(req.query.limit) || 20;
  if (!q.trim()) return res.json({ results: [] });

  try {
    const url = `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=${limit}&media_filter=tinygif,gif`;
    const response = await fetch(url);
    const data = await response.json();
    const results = (data.results || []).map(r => ({
      id: r.id,
      title: r.title || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
    }));
    res.json({ results });
  } catch {
    res.json({ results: [] });
  }
});

// Trending GIFs
router.get('/trending', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  try {
    const url = `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=${limit}&media_filter=tinygif,gif`;
    const response = await fetch(url);
    const data = await response.json();
    const results = (data.results || []).map(r => ({
      id: r.id,
      title: r.title || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
    }));
    res.json({ results });
  } catch {
    res.json({ results: [] });
  }
});

module.exports = router;
