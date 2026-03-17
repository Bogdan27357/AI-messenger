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
        <button className="icon-btn" onClick={onClose}>✕</button>
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
        <button className="send-btn" onClick={sendMessage} disabled={loading}>➤</button>
      </div>
    </div>
  );
}
