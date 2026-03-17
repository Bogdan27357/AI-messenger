const express = require('express');
const db = require('../database');

const router = express.Router();

// Get all posts (feed)
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;

  const posts = db.prepare(`
    SELECT bp.*, u.full_name as author_name, u.avatar as author_avatar, u.position as author_position,
      (SELECT COUNT(*) FROM blog_likes bl WHERE bl.post_id = bp.id) as likes_count,
      (SELECT COUNT(*) FROM blog_comments bc WHERE bc.post_id = bp.id) as comments_count,
      (SELECT 1 FROM blog_likes bl WHERE bl.post_id = bp.id AND bl.user_id = ?) as is_liked
    FROM blog_posts bp
    JOIN users u ON u.id = bp.author_id
    ORDER BY bp.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset);

  res.json(posts);
});

// Get user posts
router.get('/user/:userId', (req, res) => {
  const posts = db.prepare(`
    SELECT bp.*, u.full_name as author_name, u.avatar as author_avatar, u.position as author_position,
      (SELECT COUNT(*) FROM blog_likes bl WHERE bl.post_id = bp.id) as likes_count,
      (SELECT COUNT(*) FROM blog_comments bc WHERE bc.post_id = bp.id) as comments_count,
      (SELECT 1 FROM blog_likes bl WHERE bl.post_id = bp.id AND bl.user_id = ?) as is_liked
    FROM blog_posts bp
    JOIN users u ON u.id = bp.author_id
    WHERE bp.author_id = ?
    ORDER BY bp.created_at DESC
  `).all(req.user.id, req.params.userId);

  res.json(posts);
});

// Create post
router.post('/', (req, res) => {
  const { text, media_url, media_type } = req.body;
  const result = db.prepare(
    'INSERT INTO blog_posts (author_id, text, media_url, media_type) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, text || '', media_url || '', media_type || '');

  const post = db.prepare(`
    SELECT bp.*, u.full_name as author_name, u.avatar as author_avatar, u.position as author_position
    FROM blog_posts bp JOIN users u ON u.id = bp.author_id
    WHERE bp.id = ?
  `).get(result.lastInsertRowid);
  post.likes_count = 0;
  post.comments_count = 0;
  post.is_liked = 0;

  res.json(post);
});

// Like/unlike post
router.post('/:id/like', (req, res) => {
  const existing = db.prepare('SELECT 1 FROM blog_likes WHERE post_id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (existing) {
    db.prepare('DELETE FROM blog_likes WHERE post_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  } else {
    db.prepare('INSERT INTO blog_likes (post_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM blog_likes WHERE post_id = ?').get(req.params.id);
  res.json({ liked: !existing, count: count.c });
});

// Get comments
router.get('/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT bc.*, u.full_name as author_name, u.avatar as author_avatar
    FROM blog_comments bc JOIN users u ON u.id = bc.author_id
    WHERE bc.post_id = ?
    ORDER BY bc.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

// Add comment
router.post('/:id/comments', (req, res) => {
  const { text } = req.body;
  const result = db.prepare('INSERT INTO blog_comments (post_id, author_id, text) VALUES (?, ?, ?)')
    .run(req.params.id, req.user.id, text);

  const comment = db.prepare(`
    SELECT bc.*, u.full_name as author_name, u.avatar as author_avatar
    FROM blog_comments bc JOIN users u ON u.id = bc.author_id
    WHERE bc.id = ?
  `).get(result.lastInsertRowid);

  res.json(comment);
});

// Delete post
router.delete('/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Пост не найден' });
  if (post.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Нет прав' });
  }
  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
