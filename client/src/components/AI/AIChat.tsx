import { useState, useRef, useEffect } from 'react';
import api from '../../api/axios';
import { Bot, Send, ArrowLeft } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import Avatar from '../User/Avatar';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { id: string; title: string }[];
}

export default function AIChat() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');

    const newMessages: AIMessage[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { data } = await api.post('/ai/chat', { message: userMsg, history });
      setMessages([...newMessages, {
        role: 'assistant',
        content: data.response,
        sources: data.sources,
      }]);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Ошибка AI-ассистента';
      setMessages([...newMessages, { role: 'assistant', content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-dark-900 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700 bg-dark-800">
        <button onClick={() => setActiveChat(null)} className="p-1 hover:bg-dark-700 rounded-lg md:hidden">
          <ArrowLeft size={20} className="text-dark-300" />
        </button>
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
          <Bot size={22} className="text-white" />
        </div>
        <div>
          <div className="font-medium text-white text-sm">AI Ассистент</div>
          <div className="text-xs text-green-400">Ollama</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-dark-400 mt-12">
            <Bot size={48} className="mx-auto mb-4 text-dark-500" />
            <p className="text-lg font-medium">AI Ассистент</p>
            <p className="text-sm mt-2">Задайте вопрос по рабочим процессам</p>
            <p className="text-sm">или документам компании</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shrink-0">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white rounded-tr-sm'
                : 'bg-dark-700 text-dark-100 rounded-tl-sm'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-dark-600">
                  <div className="text-xs text-dark-400">Источники:</div>
                  {msg.sources.map((s) => (
                    <div key={s.id} className="text-xs text-primary-400">• {s.title}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-dark-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-dark-700 bg-dark-800 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Спросите AI ассистента..."
            rows={1}
            className="flex-1 bg-dark-700 border border-dark-600 rounded-xl px-4 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-primary-500 transition max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition disabled:opacity-50"
          >
            <Send size={20} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
