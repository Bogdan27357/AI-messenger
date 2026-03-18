const express = require('express');
const db = require('../database');

const router = express.Router();

// Get my contacts
router.get('/', (req, res) => {
  const contacts = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.position, u.avatar, u.status, u.bio
    FROM contacts c
    JOIN users u ON u.id = c.contact_id
    WHERE c.user_id = ?
    ORDER BY u.full_name
  `).all(req.user.id);
  res.json(contacts);
});

// Check if user is contact
router.get('/check/:userId', (req, res) => {
  const exists = db.prepare('SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?')
    .get(req.user.id, req.params.userId);
  res.json({ isContact: !!exists });
});

// Add contact
router.post('/:userId', (req, res) => {
  const contactId = parseInt(req.params.userId);
  if (contactId === req.user.id) return res.status(400).json({ error: 'Нельзя добавить себя' });

  const exists = db.prepare('SELECT 1 FROM contacts WHERE user_id = ? AND contact_id = ?')
    .get(req.user.id, contactId);
  if (exists) return res.json({ success: true, added: false });

  db.prepare('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)').run(req.user.id, contactId);
  res.json({ success: true, added: true });
});

// Remove contact
router.delete('/:userId', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?')
    .run(req.user.id, parseInt(req.params.userId));
  res.json({ success: true });
});

module.exports = router;
