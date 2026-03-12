import { config } from '../config';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function ollamaChat(message: string, history: ChatMessage[]): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'Ты — AI-ассистент корпоративного мессенджера. Помогай сотрудникам с рабочими вопросами. Отвечай на русском языке, кратко и по делу.',
    },
    ...history,
    { role: 'user', content: message },
  ];

  const response = await fetch(`${config.ollama.url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama.model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data: any = await response.json();
  return data.message?.content || 'Нет ответа от AI';
}

export async function ollamaChatWithContext(
  message: string,
  context: string,
  history: ChatMessage[]
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `Ты — AI-ассистент корпоративного мессенджера. Используй следующую базу знаний для ответов на вопросы сотрудников. Отвечай на русском языке, кратко и по делу. Если информации в базе знаний недостаточно, скажи об этом.

БАЗА ЗНАНИЙ:
${context}`,
    },
    ...history,
    { role: 'user', content: message },
  ];

  const response = await fetch(`${config.ollama.url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama.model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data: any = await response.json();
  return data.message?.content || 'Нет ответа от AI';
}
