/**
 * Интеграция с Ollama (локальная ИИ)
 * Используется для генерации тестов из рабочих документов
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

async function generateTestFromText(text, questionsCount = 5) {
  const prompt = `Ты — помощник для создания тестов по рабочим документам.
На основе следующего текста документа создай тест из ${questionsCount} вопросов.
Каждый вопрос должен иметь 4 варианта ответа, один из которых правильный.

Ответ дай СТРОГО в формате JSON:
{
  "questions": [
    {
      "question": "Текст вопроса",
      "options": ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
      "correct_answer": 0
    }
  ]
}

Текст документа:
${text.slice(0, 8000)}`;

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3',
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.7,
          num_predict: 4096,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.response);
    return parsed.questions || [];
  } catch (error) {
    console.error('Ошибка Ollama:', error.message);
    throw new Error('Не удалось сгенерировать тест. Проверьте подключение к Ollama.');
  }
}

async function generateEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
        prompt: text.slice(0, 4000)
      })
    });

    if (!response.ok) throw new Error(`Ollama embedding error: ${response.status}`);
    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('Ошибка генерации эмбеддинга:', error.message);
    return null;
  }
}

async function chatWithContext(userMessage, context, history = []) {
  const systemPrompt = `Ты — умный ассистент корпоративного мессенджера ПРМ (отдел дополнительного обслуживания аэропорта Пулково).
Отвечай на вопросы сотрудников на основе рабочих документов и контекста.
Будь вежливым и профессиональным. Отвечай на русском языке.

${context ? `Контекст из документов:\n${context}` : ''}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3',
        messages,
        stream: false,
        options: { temperature: 0.7 }
      })
    });

    if (!response.ok) throw new Error(`Ollama chat error: ${response.status}`);
    const data = await response.json();
    return data.message?.content || 'Не удалось получить ответ.';
  } catch (error) {
    console.error('Ошибка Ollama chat:', error.message);
    throw new Error('ИИ-ассистент недоступен. Проверьте подключение к Ollama.');
  }
}

async function checkOllamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) return { status: 'error', message: 'Ollama не отвечает' };
    const data = await response.json();
    return { status: 'ok', models: data.models?.map(m => m.name) || [] };
  } catch {
    return { status: 'error', message: 'Не удалось подключиться к Ollama' };
  }
}

module.exports = { generateTestFromText, generateEmbedding, chatWithContext, checkOllamaStatus };
