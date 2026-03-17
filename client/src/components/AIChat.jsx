import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { getInitials } from '../utils/format';

export default function AIChat({ onClose }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Здравствуйте! Я ИИ-ассистент ПРМ. Могу ответить на вопросы по рабочим документам. Чем помочь?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const data = await api.post('/ai/chat', { message: input, history }, token);
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ошибка: ' + err.message }]);
    }
    setLoading(false);
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <span className="ai-chat-title">🤖 ИИ-ассистент ПРМ</span>
        <button className="icon-btn" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="ai-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role === 'user' ? 'own' : ''}`}>
            {msg.role === 'assistant' && <div className="avatar tiny" style={{ background: '#8b5cf6' }}>AI</div>}
            <div className="ai-message-text">{msg.content}</div>
          </div>
        ))}
        {loading && <div className="ai-typing">ИИ печатает...</div>}
      </div>
      <div className="ai-chat-input">
        <input
          placeholder="Задайте вопрос..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
        />
        <button className="send-btn" onClick={sendMessage} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  );
}
