const express = require('express');
const db = require('../database');

const router = express.Router();

// Get all chats for current user
router.get('/', (req, res) => {
  const chats = db.prepare(`
    SELECT c.*, cm.role as member_role,
      (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.is_read = 0 AND m.sender_id != ?) as unread_count,
      (SELECT m.text FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
      (SELECT m.sender_id FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_sender
    FROM chats c
    JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = ?
    ORDER BY last_message_at DESC NULLS LAST
  `).all(req.user.id, req.user.id);

  // For private chats, get other user info
  for (const chat of chats) {
    if (chat.type === 'private') {
      const other = db.prepare(`
        SELECT u.id, u.full_name, u.avatar, u.status
        FROM chat_members cm JOIN users u ON u.id = cm.user_id
        WHERE cm.chat_id = ? AND cm.user_id != ?
      `).get(chat.id, req.user.id);
      if (other) {
        chat.other_user = other;
        chat.name = other.full_name;
        chat.avatar = other.avatar;
      }
    }
    chat.members = db.prepare(`
      SELECT u.id, u.full_name, u.avatar, u.status, cm.role
      FROM chat_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.chat_id = ?
    `).all(chat.id);
  }

  res.json(chats);
});

// Create private chat
router.post('/private', (req, res) => {
  const { userId } = req.body;
  // Check if chat already exists
  const existing = db.prepare(`
    SELECT c.id FROM chats c
    JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
    JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
    WHERE c.type = 'private'
  `).get(req.user.id, userId);

  if (existing) {
    return res.json({ chatId: existing.id });
  }

  const result = db.prepare('INSERT INTO chats (type, created_by) VALUES (?, ?)').run('private', req.user.id);
  const chatId = result.lastInsertRowid;
  db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)').run(chatId, req.user.id);
  db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)').run(chatId, userId);

  res.json({ chatId });
});

// Create group chat
router.post('/group', (req, res) => {
  const { name, memberIds } = req.body;
  const result = db.prepare('INSERT INTO chats (type, name, created_by) VALUES (?, ?, ?)').run('group', name, req.user.id);
  const chatId = result.lastInsertRowid;

  db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, req.user.id, 'admin');
  for (const id of memberIds) {
    db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)').run(chatId, id);
  }

  res.json({ chatId });
});

// Get chat by id
router.get('/:id', (req, res) => {
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(req.params.id);
  if (!chat) return res.status(404).json({ error: 'Чат не найден' });

  const isMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chat.id, req.user.id);
  if (!isMember) return res.status(403).json({ error: 'Нет доступа' });

  chat.members = db.prepare(`
    SELECT u.id, u.full_name, u.avatar, u.status, u.position, cm.role
    FROM chat_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.chat_id = ?
  `).all(chat.id);

  if (chat.type === 'private') {
    const other = chat.members.find(m => m.id !== req.user.id);
    if (other) {
      chat.name = other.full_name;
      chat.avatar = other.avatar;
    }
  }

  res.json(chat);
});

module.exports = router;
