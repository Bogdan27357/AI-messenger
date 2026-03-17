const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const { sendToUser } = require('../ws');

const router = express.Router();

// ==================== USER MANAGEMENT ====================

router.post('/users', requireAdmin, (req, res) => {
  const { username, password, full_name, position, role } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(
      'INSERT INTO users (username, password, full_name, position, role) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hash, full_name, position || '', role || 'employee');
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'Пользователь уже существует' });
  }
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ? AND id != ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ==================== MENTOR ASSIGNMENT ====================

router.post('/mentors/assign', requireAdmin, (req, res) => {
  const { userId, mentorId } = req.body;
  db.prepare('UPDATE users SET mentor_id = ? WHERE id = ?').run(mentorId, userId);

  const mentor = db.prepare('SELECT full_name FROM users WHERE id = ?').get(mentorId);
  const employee = db.prepare('SELECT full_name FROM users WHERE id = ?').get(userId);

  // Notify employee
  db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)')
    .run(userId, 'mentor', 'Назначен наставник', `Вам назначен наставник: ${mentor.full_name}`);
  sendToUser(userId, { type: 'notification', title: 'Назначен наставник', message: `Вам назначен наставник: ${mentor.full_name}` });

  // Notify mentor
  db.prepare('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)')
    .run(mentorId, 'mentor', 'Назначение наставником', `Вы назначены наставником для: ${employee.full_name}`);
  sendToUser(mentorId, { type: 'notification', title: 'Назначение наставником', message: `Вы назначены наставником для: ${employee.full_name}` });

  res.json({ success: true });
});

// ==================== DOCUMENTS ====================

router.get('/documents', requireAdmin, (req, res) => {
  const docs = db.prepare(`
    SELECT d.*, u.full_name as uploader_name FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    ORDER BY d.created_at DESC
  `).all();
  res.json(docs);
});

router.post('/documents', requireAdmin, (req, res) => {
  const { title, file_url, file_name } = req.body;
  const result = db.prepare(
    'INSERT INTO documents (title, file_url, file_name, uploaded_by) VALUES (?, ?, ?, ?)'
  ).run(title, file_url, file_name, req.user.id);
  res.json({ id: result.lastInsertRowid });
});

// ==================== TEST MANAGEMENT ====================

router.get('/tests', requireAdmin, (req, res) => {
  const tests = db.prepare(`
    SELECT t.*, u.full_name as creator_name,
      (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id) as questions_count,
      (SELECT COUNT(*) FROM test_assignments ta WHERE ta.test_id = t.id) as assigned_count
    FROM tests t JOIN users u ON u.id = t.created_by
    ORDER BY t.created_at DESC
  `).all();
  res.json(tests);
});

router.post('/tests', requireAdmin, (req, res) => {
  const { title, description, document_id, questions, time_limit } = req.body;
  const result = db.prepare(
    'INSERT INTO tests (title, description, document_id, created_by, time_limit) VALUES (?, ?, ?, ?, ?)'
  ).run(title, description || '', document_id || null, req.user.id, time_limit || 0);

  const testId = result.lastInsertRowid;
  if (questions && questions.length > 0) {
    const stmt = db.prepare(
      'INSERT INTO test_questions (test_id, question, options, correct_answer, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      stmt.run(testId, q.question, JSON.stringify(q.options), q.correct_answer, i);
    }
  }

  res.json({ id: testId });
});

router.get('/tests/:id', (req, res) => {
  const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(req.params.id);
  if (!test) return res.status(404).json({ error: 'Тест не найден' });

  test.questions = db.prepare('SELECT * FROM test_questions WHERE test_id = ? ORDER BY sort_order').all(test.id);
  test.questions.forEach(q => { q.options = JSON.parse(q.options); });

  test.assignments = db.prepare(`
    SELECT ta.*, u.full_name as user_name
    FROM test_assignments ta JOIN users u ON u.id = ta.user_id
    WHERE ta.test_id = ?
  `).all(test.id);

  res.json(test);
});

// Assign test to users
router.post('/tests/:id/assign', requireAdmin, (req, res) => {
  const { userIds } = req.body;
  const test = db.prepare('SELECT title FROM tests WHERE id = ?').get(req.params.id);

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO test_assignments (test_id, user_id, assigned_by) VALUES (?, ?, ?)'
  );
  const notifStmt = db.prepare(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)'
  );

  for (const userId of userIds) {
    stmt.run(req.params.id, userId, req.user.id);
    notifStmt.run(userId, 'test', 'Назначен тест', `Вам назначен тест: ${test.title}`, `/tests/${req.params.id}`);
    sendToUser(userId, { type: 'notification', title: 'Назначен тест', message: `Вам назначен тест: ${test.title}` });
  }

  res.json({ success: true });
});

// ==================== USER TESTS (for employees) ====================

router.get('/my-tests', (req, res) => {
  const tests = db.prepare(`
    SELECT ta.*, t.title, t.description, t.time_limit,
      (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id) as questions_count
    FROM test_assignments ta
    JOIN tests t ON t.id = ta.test_id
    WHERE ta.user_id = ?
    ORDER BY ta.assigned_at DESC
  `).all(req.user.id);
  res.json(tests);
});

// Take test
router.post('/tests/:id/submit', (req, res) => {
  const { answers } = req.body;
  const assignment = db.prepare(
    'SELECT * FROM test_assignments WHERE test_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);
  if (!assignment) return res.status(403).json({ error: 'Тест не назначен' });

  const questions = db.prepare('SELECT * FROM test_questions WHERE test_id = ? ORDER BY sort_order')
    .all(req.params.id);

  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].correct_answer) correct++;
  }
  const score = Math.round((correct / questions.length) * 100);

  db.prepare(`
    UPDATE test_assignments SET status = 'completed', score = ?, answers = ?, completed_at = CURRENT_TIMESTAMP
    WHERE test_id = ? AND user_id = ?
  `).run(score, JSON.stringify(answers), req.params.id, req.user.id);

  res.json({ score, correct, total: questions.length });
});

// ==================== TRAINING MANAGEMENT ====================

router.get('/trainings', (req, res) => {
  const trainings = db.prepare(`
    SELECT t.*, u.full_name as creator_name,
      (SELECT COUNT(*) FROM training_assignments ta WHERE ta.training_id = t.id) as assigned_count
    FROM trainings t JOIN users u ON u.id = t.created_by
    ORDER BY t.created_at DESC
  `).all();
  res.json(trainings);
});

router.post('/trainings', requireAdmin, (req, res) => {
  const { title, description, start_date, end_date, location } = req.body;
  const result = db.prepare(
    'INSERT INTO trainings (title, description, start_date, end_date, location, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, description || '', start_date, end_date, location || '', req.user.id);
  res.json({ id: result.lastInsertRowid });
});

router.post('/trainings/:id/assign', requireAdmin, (req, res) => {
  const { userIds } = req.body;
  const training = db.prepare('SELECT * FROM trainings WHERE id = ?').get(req.params.id);

  const stmt = db.prepare(
    'INSERT OR IGNORE INTO training_assignments (training_id, user_id) VALUES (?, ?)'
  );
  const notifStmt = db.prepare(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)'
  );

  for (const userId of userIds) {
    stmt.run(req.params.id, userId);
    const msg = `Вам назначено обучение: ${training.title}. Дата: ${training.start_date || 'не указана'}. Место: ${training.location || 'не указано'}`;
    notifStmt.run(userId, 'training', 'Назначено обучение', msg, `/trainings`);
    sendToUser(userId, { type: 'notification', title: 'Назначено обучение', message: msg });
  }

  res.json({ success: true });
});

// My trainings
router.get('/my-trainings', (req, res) => {
  const trainings = db.prepare(`
    SELECT ta.*, t.title, t.description, t.start_date, t.end_date, t.location
    FROM training_assignments ta
    JOIN trainings t ON t.id = ta.training_id
    WHERE ta.user_id = ?
    ORDER BY t.start_date DESC
  `).all(req.user.id);
  res.json(trainings);
});

module.exports = router;
