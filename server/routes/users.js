const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');

const router = express.Router();

// Get all users
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT id, username, full_name, position, department, avatar, role, status, bio, mentor_id, created_at
    FROM users ORDER BY full_name
  `).all();
  res.json(users);
});

// Get user by id
router.get('/:id', (req, res) => {
  const user = db.prepare(`
    SELECT id, username, full_name, position, department, avatar, role, status, bio, mentor_id, created_at
    FROM users WHERE id = ?
  `).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  if (user.mentor_id) {
    user.mentor = db.prepare('SELECT id, full_name, avatar, position FROM users WHERE id = ?').get(user.mentor_id);
  }
  res.json(user);
});

// Update profile
router.put('/profile', (req, res) => {
  const { full_name, position, bio, avatar } = req.body;
  db.prepare(`
    UPDATE users SET full_name = COALESCE(?, full_name), position = COALESCE(?, position),
    bio = COALESCE(?, bio), avatar = COALESCE(?, avatar) WHERE id = ?
  `).run(full_name, position, bio, avatar, req.user.id);

  const user = db.prepare('SELECT id, username, full_name, position, department, avatar, role, status, bio FROM users WHERE id = ?')
    .get(req.user.id);
  res.json(user);
});

// Change password
router.put('/password', (req, res) => {
  const { current_password, new_password } = req.body;
  const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

  if (!bcrypt.compareSync(current_password, user.password)) {
    return res.status(400).json({ error: 'Неверный текущий пароль' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ success: true });
});

module.exports = router;
