const express = require('express');
const db = require('../database');
const { sendToChat } = require('../ws');

const router = express.Router();

// Get messages for a chat
router.get('/:chatId', (req, res) => {
  const { chatId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const isMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
  if (!isMember) return res.status(403).json({ error: 'Нет доступа' });

  const messages = db.prepare(`
    SELECT m.*, u.full_name as sender_name, u.avatar as sender_avatar,
      r.text as reply_text, r.sender_id as reply_sender_id,
      ru.full_name as reply_sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN messages r ON r.id = m.reply_to
    LEFT JOIN users ru ON ru.id = r.sender_id
    WHERE m.chat_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(chatId, limit, offset);

  // Mark as read
  db.prepare('UPDATE messages SET is_read = 1 WHERE chat_id = ? AND sender_id != ? AND is_read = 0')
    .run(chatId, req.user.id);

  res.json(messages.reverse());
});

// Send message
router.post('/:chatId', (req, res) => {
  const { chatId } = req.params;
  const { text, file_url, file_name, file_type, reply_to } = req.body;

  const isMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
  if (!isMember) return res.status(403).json({ error: 'Нет доступа' });

  const result = db.prepare(`
    INSERT INTO messages (chat_id, sender_id, text, file_url, file_name, file_type, reply_to)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chatId, req.user.id, text || '', file_url || '', file_name || '', file_type || '', reply_to || null);

  const message = db.prepare(`
    SELECT m.*, u.full_name as sender_name, u.avatar as sender_avatar
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  sendToChat(parseInt(chatId), { type: 'new_message', message }, null);

  res.json(message);
});

// Delete message
router.delete('/:id', (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Сообщение не найдено' });
  if (msg.sender_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Нет прав' });
  }
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  sendToChat(msg.chat_id, { type: 'message_deleted', messageId: msg.id, chatId: msg.chat_id });
  res.json({ success: true });
});

module.exports = router;
