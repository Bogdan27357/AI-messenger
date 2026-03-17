const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/auth');
const { generateTestFromText, generateEmbedding, chatWithContext, checkOllamaStatus } = require('../services/ollama');
const { upsertDocument, searchSimilar, checkQdrantStatus } = require('../services/qdrant');
const db = require('../database');

const router = express.Router();

// Check AI services status
router.get('/status', requireAdmin, async (req, res) => {
  const [ollama, qdrant] = await Promise.all([
    checkOllamaStatus(),
    checkQdrantStatus()
  ]);
  res.json({ ollama, qdrant });
});

// Generate test from document using Ollama
router.post('/generate-test', requireAdmin, async (req, res) => {
  const { documentId, questionsCount = 5, title } = req.body;

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) return res.status(404).json({ error: 'Документ не найден' });

  // Read document text (supports .txt files directly, for others — use stored text)
  const filePath = path.join(__dirname, '..', doc.file_url);
  let text = '';

  try {
    if (fs.existsSync(filePath)) {
      text = fs.readFileSync(filePath, 'utf-8');
    }
  } catch (e) {
    // File may be binary
  }

  if (!text && doc.content_text) {
    text = doc.content_text;
  }

  if (!text) {
    return res.status(400).json({ error: 'Не удалось прочитать текст документа. Загрузите текстовый документ (.txt).' });
  }

  try {
    const questions = await generateTestFromText(text, questionsCount);

    // Create test in DB
    const result = db.prepare(
      'INSERT INTO tests (title, description, document_id, created_by, time_limit) VALUES (?, ?, ?, ?, ?)'
    ).run(
      title || `Тест по: ${doc.title}`,
      `Автоматически сгенерирован ИИ из документа "${doc.title}"`,
      documentId,
      req.user.id,
      questionsCount * 2 // 2 minutes per question
    );

    const testId = result.lastInsertRowid;
    const stmt = db.prepare(
      'INSERT INTO test_questions (test_id, question, options, correct_answer, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      stmt.run(testId, q.question, JSON.stringify(q.options), q.correct_answer, i);
    }

    res.json({ testId, questionsGenerated: questions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Index document in Qdrant
router.post('/index-document', requireAdmin, async (req, res) => {
  const { documentId } = req.body;
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) return res.status(404).json({ error: 'Документ не найден' });

  const filePath = path.join(__dirname, '..', doc.file_url);
  let text = '';
  try {
    if (fs.existsSync(filePath)) text = fs.readFileSync(filePath, 'utf-8');
  } catch {}

  if (!text) return res.status(400).json({ error: 'Не удалось прочитать документ' });

  // Split into chunks
  const chunks = splitIntoChunks(text, 500);
  let indexed = 0;

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    if (embedding) {
      const pointId = documentId * 10000 + i;
      await upsertDocument(pointId, embedding, {
        document_id: documentId,
        document_title: doc.title,
        chunk_index: i,
        text: chunks[i]
      });
      indexed++;
    }
  }

  res.json({ indexed, totalChunks: chunks.length });
});

// AI Chat — semantic search + Ollama answer
router.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  let context = '';
  try {
    const embedding = await generateEmbedding(message);
    if (embedding) {
      const results = await searchSimilar(embedding, 3);
      context = results.map(r => r.payload.text).join('\n\n---\n\n');
    }
  } catch {}

  try {
    const answer = await chatWithContext(message, context, history);
    res.json({ answer, hasContext: !!context });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function splitIntoChunks(text, wordsPerChunk = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '));
  }
  return chunks;
}

module.exports = router;
