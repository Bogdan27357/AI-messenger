import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../User/Avatar';
import {
  Search, Plus, Settings, LogOut, Shield, Bot, MessageCircle, Users,
} from 'lucide-react';
import api from '../../api/axios';
import type { User } from '../../types';

export default function Sidebar() {
  const { chats, activeChat, setActiveChat, loadChats, createChat, typingUsers } = useChatStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadChats();
  }, []);

  const filteredChats = chats.filter((chat) => {
    const chatName = getChatName(chat);
    return chatName.toLowerCase().includes(search.toLowerCase());
  });

  function getChatName(chat: any) {
    if (chat.type === 'GROUP') return chat.name || 'Группа';
    const other = chat.members?.find((m: any) => m.userId !== user?.id);
    return other?.user?.displayName || other?.user?.name || 'Чат';
  }

  function getChatAvatar(chat: any) {
    if (chat.type === 'GROUP') return chat.avatar;
    const other = chat.members?.find((m: any) => m.userId !== user?.id);
    return other?.user?.avatar;
  }

  function getChatOnline(chat: any) {
    if (chat.type === 'GROUP') return undefined;
    const other = chat.members?.find((m: any) => m.userId !== user?.id);
    return other?.user?.isOnline;
  }

  function getLastMessage(chat: any) {
    const msg = chat.messages?.[0];
    if (!msg) return '';
    if (msg.type === 'VOICE') return '🎤 Голосовое сообщение';
    if (msg.type === 'VIDEO_CIRCLE') return '🔵 Видеокружок';
    if (msg.type === 'IMAGE') return '📷 Фото';
    if (msg.type === 'VIDEO') return '🎥 Видео';
    if (msg.type === 'FILE') return '📎 Файл';
    return msg.content || '';
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  async function handleNewChat() {
    setShowNewChat(true);
    const { data } = await api.get('/users');
    setUsers(data.filter((u: User) => u.id !== user?.id));
  }

  async function handleSelectUser(targetUser: User) {
    const chat = await createChat('DIRECT', [targetUser.id]);
    setActiveChat(chat);
    setShowNewChat(false);
  }

  async function openAIChat() {
    // Check if AI chat already exists
    const existingAI = chats.find(c => c.name === 'AI Ассистент');
    if (existingAI) {
      setActiveChat(existingAI);
      return;
    }
    // For AI, we'll use a special route in ChatWindow
    setActiveChat({ id: 'ai-assistant', type: 'DIRECT', name: 'AI Ассистент', createdBy: '', createdAt: '', updatedAt: '', members: [] } as any);
  }

  return (
    <div className="w-80 bg-dark-800 border-r border-dark-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageCircle size={22} className="text-primary-500" />
            AI Messenger
          </h1>
          <div className="flex items-center gap-1">
            <button onClick={handleNewChat} className="p-2 hover:bg-dark-700 rounded-lg transition" title="Новый чат">
              <Plus size={18} className="text-dark-300" />
            </button>
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-dark-700 rounded-lg transition">
                <Settings size={18} className="text-dark-300" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-dark-700 rounded-lg shadow-xl py-1 w-48 z-50">
                  <button onClick={() => { navigate('/profile'); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 flex items-center gap-2">
                    <Settings size={16} /> Профиль
                  </button>
                  <button onClick={openAIChat} className="w-full text-left px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 flex items-center gap-2">
                    <Bot size={16} /> AI Ассистент
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button onClick={() => { navigate('/admin'); setShowMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-dark-200 hover:bg-dark-600 flex items-center gap-2">
                      <Shield size={16} /> Админ-панель
                    </button>
                  )}
                  <hr className="border-dark-600 my-1" />
                  <button onClick={() => { logout(); navigate('/login'); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-dark-600 flex items-center gap-2">
                    <LogOut size={16} /> Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск чатов..."
            className="w-full bg-dark-700 border border-dark-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {showNewChat ? (
          <div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
              <span className="text-sm font-medium text-dark-300">Новый чат</span>
              <button onClick={() => setShowNewChat(false)} className="text-xs text-primary-400">Отмена</button>
            </div>
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-700 transition"
              >
                <Avatar src={u.avatar} name={u.name} isOnline={u.isOnline} />
                <div className="text-left">
                  <div className="text-sm font-medium text-white">{u.displayName || u.name}</div>
                  <div className="text-xs text-dark-400">{u.email}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = activeChat?.id === chat.id;
            const chatTyping = typingUsers.get(chat.id);
            const isTyping = chatTyping && chatTyping.size > 0;

            return (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition ${
                  isActive ? 'bg-primary-600/20' : 'hover:bg-dark-700'
                }`}
              >
                <Avatar
                  src={getChatAvatar(chat)}
                  name={getChatName(chat)}
                  isOnline={getChatOnline(chat)}
                />
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">{getChatName(chat)}</span>
                    {chat.messages?.[0] && (
                      <span className="text-xs text-dark-400 shrink-0 ml-2">{formatTime(chat.messages[0].createdAt)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    {isTyping ? (
                      <span className="text-xs text-primary-400">печатает...</span>
                    ) : (
                      <span className="text-xs text-dark-400 truncate">{getLastMessage(chat)}</span>
                    )}
                    {chat.unreadCount ? (
                      <span className="bg-primary-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shrink-0 ml-2">
                        {chat.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* User info */}
      <div className="p-3 border-t border-dark-700 flex items-center gap-3">
        <Avatar src={user?.avatar} name={user?.name || ''} size="sm" isOnline={true} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{user?.displayName || user?.name}</div>
          <div className="text-xs text-dark-400 truncate">{user?.email}</div>
        </div>
      </div>
    </div>
  );
}
