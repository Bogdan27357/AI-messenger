import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, uploadFile } from '../utils/api';
import { formatTime, getInitials } from '../utils/format';

export default function ChatsPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [currentChat, setCurrentChat] = useState(null);
  const [users, setUsers] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [typing, setTyping] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadChats();
    api.get('/users', token).then(setUsers).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (chatId) {
      loadMessages(chatId);
      api.get(`/chats/${chatId}`, token).then(setCurrentChat).catch(() => {});
    } else {
      setCurrentChat(null);
      setMessages([]);
    }
  }, [chatId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      if (data.type === 'new_message') {
        if (data.message.chat_id === parseInt(chatId)) {
          setMessages(prev => [...prev, data.message]);
        }
        loadChats();
      }
      if (data.type === 'message_deleted') {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
      }
      if (data.type === 'typing' && data.chatId === parseInt(chatId)) {
        setTyping(prev => ({ ...prev, [data.userId]: Date.now() }));
        setTimeout(() => setTyping(prev => {
          const copy = { ...prev };
          if (Date.now() - copy[data.userId] > 2500) delete copy[data.userId];
          return copy;
        }), 3000);
      }
    };
    window.addEventListener('ws-message', handler);
    return () => window.removeEventListener('ws-message', handler);
  }, [chatId]);

  const loadChats = () => api.get('/chats', token).then(setChats).catch(() => {});
  const loadMessages = (id) => api.get(`/messages/${id}`, token).then(setMessages).catch(() => {});

  const sendMessage = async () => {
    if (!messageText.trim() && !replyTo) return;
    const body = { text: messageText, reply_to: replyTo?.id || null };
    await api.post(`/messages/${chatId}`, body, token);
    setMessageText('');
    setReplyTo(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file, token);
      await api.post(`/messages/${chatId}`, {
        text: '',
        file_url: uploaded.url,
        file_name: uploaded.name,
        file_type: uploaded.type
      }, token);
    } catch (err) {
      alert('Ошибка загрузки файла');
    }
    e.target.value = '';
  };

  const createPrivateChat = async (userId) => {
    const data = await api.post('/chats/private', { userId }, token);
    setShowNewChat(false);
    navigate(`/chats/${data.chatId}`);
    loadChats();
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const data = await api.post('/chats/group', { name: groupName, memberIds: selectedUsers }, token);
    setShowNewGroup(false);
    setGroupName('');
    setSelectedUsers([]);
    navigate(`/chats/${data.chatId}`);
    loadChats();
  };

  const deleteMessage = async (msgId) => {
    if (!confirm('Удалить сообщение?')) return;
    await api.delete(`/messages/${msgId}`, token);
  };

  const filteredChats = chats.filter(c => {
    if (!searchQuery) return true;
    return (c.name || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const isImage = (type) => type && type.startsWith('image/');
  const isVideo = (type) => type && type.startsWith('video/');

  return (
    <div className="chats-page">
      {/* Chat list sidebar */}
      <div className={`chat-list-panel ${chatId ? 'mobile-hidden' : ''}`}>
        <div className="chat-list-header">
          <h2>Чаты</h2>
          <div className="chat-list-actions">
            <button className="icon-btn" onClick={() => setShowNewChat(true)} title="Новый чат">✏️</button>
            <button className="icon-btn" onClick={() => setShowNewGroup(true)} title="Новая группа">👥</button>
          </div>
        </div>
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="chat-list">
          {filteredChats.map(chat => (
            <div
              key={chat.id}
              className={`chat-item ${parseInt(chatId) === chat.id ? 'active' : ''}`}
              onClick={() => navigate(`/chats/${chat.id}`)}
            >
              <div className="avatar">
                {chat.type === 'group' ? '👥' : getInitials(chat.name)}
              </div>
              <div className="chat-item-info">
                <div className="chat-item-top">
                  <span className="chat-item-name">{chat.name || 'Чат'}</span>
                  <span className="chat-item-time">{formatTime(chat.last_message_at)}</span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-preview">{chat.last_message || 'Нет сообщений'}</span>
                  {chat.unread_count > 0 && <span className="unread-badge">{chat.unread_count}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat messages area */}
      <div className={`chat-area ${!chatId ? 'mobile-hidden' : ''}`}>
        {chatId && currentChat ? (
          <>
            <div className="chat-header">
              <button className="back-btn mobile-only" onClick={() => navigate('/chats')}>←</button>
              <div className="avatar">{currentChat.type === 'group' ? '👥' : getInitials(currentChat.name)}</div>
              <div className="chat-header-info">
                <div className="chat-header-name">{currentChat.name}</div>
                <div className="chat-header-status">
                  {Object.keys(typing).length > 0 ? 'печатает...' :
                    currentChat.type === 'group' ?
                    `${currentChat.members?.length || 0} участников` :
                    currentChat.members?.find(m => m.id !== user.id)?.status === 'online' ? 'в сети' : 'не в сети'
                  }
                </div>
              </div>
            </div>

            <div className="messages-area">
              {messages.map(msg => (
                <div key={msg.id} className={`message ${msg.sender_id === user.id ? 'own' : ''}`}>
                  {msg.sender_id !== user.id && currentChat.type === 'group' && (
                    <div className="message-sender">{msg.sender_name}</div>
                  )}
                  {msg.reply_to && (
                    <div className="message-reply">
                      <span className="reply-author">{msg.reply_sender_name}</span>
                      <span className="reply-text">{msg.reply_text}</span>
                    </div>
                  )}
                  {msg.file_url && isImage(msg.file_type) && (
                    <img src={msg.file_url} alt={msg.file_name} className="message-image" />
                  )}
                  {msg.file_url && isVideo(msg.file_type) && (
                    <video src={msg.file_url} controls className="message-video" />
                  )}
                  {msg.file_url && !isImage(msg.file_type) && !isVideo(msg.file_type) && (
                    <a href={msg.file_url} download={msg.file_name} className="message-file">
                      📎 {msg.file_name}
                    </a>
                  )}
                  {msg.text && <div className="message-text">{msg.text}</div>}
                  <div className="message-meta">
                    <span className="message-time">{formatTime(msg.created_at)}</span>
                    {msg.sender_id === user.id && (
                      <span className="message-status">{msg.is_read ? '✓✓' : '✓'}</span>
                    )}
                  </div>
                  <div className="message-actions">
                    <button onClick={() => setReplyTo(msg)} title="Ответить">↩</button>
                    {(msg.sender_id === user.id || user.role === 'admin') && (
                      <button onClick={() => deleteMessage(msg.id)} title="Удалить">🗑</button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-area">
              {replyTo && (
                <div className="reply-preview">
                  <span>Ответ для {replyTo.sender_name}: {replyTo.text?.slice(0, 50)}</span>
                  <button onClick={() => setReplyTo(null)}>✕</button>
                </div>
              )}
              <div className="message-input-row">
                <button className="icon-btn" onClick={() => fileInputRef.current?.click()}>📎</button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden />
                <input
                  type="text"
                  placeholder="Сообщение..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                />
                <button className="send-btn" onClick={sendMessage}>➤</button>
              </div>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <img src="/logo.png" alt="ПРМ" style={{ width: 120, opacity: 0.5 }} />
            <p>Выберите чат для начала общения</p>
          </div>
        )}
      </div>

      {/* New chat modal */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Новый чат</h3>
            <div className="user-list">
              {users.filter(u => u.id !== user.id).map(u => (
                <div key={u.id} className="user-list-item" onClick={() => createPrivateChat(u.id)}>
                  <div className="avatar small">{getInitials(u.full_name)}</div>
                  <div>
                    <div className="user-list-name">{u.full_name}</div>
                    <div className="user-list-pos">{u.position}</div>
                  </div>
                  <span className={`status-dot ${u.status}`} />
                </div>
              ))}
            </div>
            <button className="btn secondary" onClick={() => setShowNewChat(false)}>Отмена</button>
          </div>
        </div>
      )}

      {/* New group modal */}
      {showNewGroup && (
        <div className="modal-overlay" onClick={() => setShowNewGroup(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Новая группа</h3>
            <input
              type="text"
              placeholder="Название группы"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="modal-input"
            />
            <div className="user-list">
              {users.filter(u => u.id !== user.id).map(u => (
                <label key={u.id} className="user-list-item checkbox">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedUsers([...selectedUsers, u.id]);
                      else setSelectedUsers(selectedUsers.filter(id => id !== u.id));
                    }}
                  />
                  <div className="avatar small">{getInitials(u.full_name)}</div>
                  <span>{u.full_name}</span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn primary" onClick={createGroupChat}>Создать</button>
              <button className="btn secondary" onClick={() => setShowNewGroup(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
