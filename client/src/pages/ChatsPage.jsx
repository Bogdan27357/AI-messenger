import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, uploadFile } from '../utils/api';
import { formatTime, getInitials } from '../utils/format';
import UserAvatar, { GroupAvatar } from '../components/UserAvatar';

function getDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today - msgDate) / 86400000;
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

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
  const [profilePanel, setProfilePanel] = useState(null);
  const [showChatEmoji, setShowChatEmoji] = useState(false);
  const [showChatGif, setShowChatGif] = useState(false);
  const [chatGifSearch, setChatGifSearch] = useState('');
  const [chatGifs, setChatGifs] = useState([]);
  const [chatGifLoading, setChatGifLoading] = useState(false);
  const chatGifTimerRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showVideoNote, setShowVideoNote] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoRecordingTime, setVideoRecordingTime] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoTimerRef = useRef(null);
  const videoStreamRef = useRef(null);
  const videoPreviewRef = useRef(null);

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
      if (data.type === 'messages_read' && data.chatId === parseInt(chatId)) {
        setMessages(prev => prev.map(m =>
          data.messageIds.includes(m.id) ? { ...m, is_read: 1 } : m
        ));
      }
      if (data.type === 'message_read' && data.chatId === parseInt(chatId)) {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId ? { ...m, is_read: 1 } : m
        ));
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
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      alert(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Максимум: 50 МБ`);
      e.target.value = '';
      return;
    }
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

  // Voice recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        const ext = recorder.mimeType.includes('webm') ? 'webm' : 'm4a';
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: recorder.mimeType });
        try {
          const uploaded = await uploadFile(file, token);
          await api.post(`/messages/${chatId}`, {
            text: '',
            file_url: uploaded.url,
            file_name: file.name,
            file_type: `audio/${ext}`
          }, token);
        } catch { alert('Ошибка отправки голосового'); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      alert('Нет доступа к микрофону');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {};
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  };

  // Video note (circular) recording
  const startVideoNote = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320, facingMode: 'user' }, audio: true });
      videoStreamRef.current = stream;
      setShowVideoNote(true);
      setTimeout(() => {
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.play();
        }
      }, 100);
    } catch {
      alert('Нет доступа к камере');
    }
  };

  const startVideoRecording = () => {
    const stream = videoStreamRef.current;
    if (!stream) return;
    const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4' });
    videoChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(videoChunksRef.current, { type: recorder.mimeType });
      const ext = recorder.mimeType.includes('webm') ? 'webm' : 'mp4';
      const file = new File([blob], `videonote_${Date.now()}.${ext}`, { type: `video/${ext}` });
      try {
        const uploaded = await uploadFile(file, token);
        await api.post(`/messages/${chatId}`, {
          text: '',
          file_url: uploaded.url,
          file_name: file.name,
          file_type: `video/${ext}`
        }, token);
      } catch { alert('Ошибка отправки видеосообщения'); }
      closeVideoNote();
    };
    recorder.start();
    videoRecorderRef.current = recorder;
    setIsRecordingVideo(true);
    setVideoRecordingTime(0);
    videoTimerRef.current = setInterval(() => setVideoRecordingTime(t => t + 1), 1000);
  };

  const stopVideoRecording = () => {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoRecorderRef.current.stop();
    }
    clearInterval(videoTimerRef.current);
    setIsRecordingVideo(false);
    setVideoRecordingTime(0);
  };

  const closeVideoNote = () => {
    if (videoStreamRef.current) videoStreamRef.current.getTracks().forEach(t => t.stop());
    if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
      videoRecorderRef.current.ondataavailable = null;
      videoRecorderRef.current.onstop = () => {};
      videoRecorderRef.current.stop();
    }
    clearInterval(videoTimerRef.current);
    videoStreamRef.current = null;
    setShowVideoNote(false);
    setIsRecordingVideo(false);
    setVideoRecordingTime(0);
  };

  const formatRecTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const EMOJI_LIST = [
    '😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳',
    '😢','😭','😤','😡','🤯','😱','🥺','😴','🤔','🤗',
    '👍','👎','👏','🙌','🤝','💪','❤️','🔥','⭐','🎉',
    '💯','🙏','😈','💀','🤡','👀','💬','📸','🎵','🚀',
    '✅','❌','⚡','💎','🌟','🎯','💡','🏆','🎁','🌈',
  ];

  const openChatGifPicker = () => {
    setShowChatGif(true);
    setChatGifSearch('');
    setChatGifs([]);
    setChatGifLoading(true);
    api.get('/gif/trending?limit=20', token).then(d => setChatGifs(d.results || [])).catch(() => {}).finally(() => setChatGifLoading(false));
  };

  const searchChatGifs = (q) => {
    setChatGifSearch(q);
    clearTimeout(chatGifTimerRef.current);
    if (!q.trim()) {
      setChatGifLoading(true);
      api.get('/gif/trending?limit=20', token).then(d => setChatGifs(d.results || [])).catch(() => {}).finally(() => setChatGifLoading(false));
      return;
    }
    chatGifTimerRef.current = setTimeout(async () => {
      setChatGifLoading(true);
      try {
        const data = await api.get(`/gif/search?q=${encodeURIComponent(q)}&limit=20`, token);
        setChatGifs(data.results || []);
      } catch { setChatGifs([]); }
      setChatGifLoading(false);
    }, 400);
  };

  const selectChatGif = async (gif) => {
    setShowChatGif(false);
    try {
      await api.post(`/messages/${chatId}`, { text: gif.url, file_url: '', file_name: '', file_type: '' }, token);
    } catch {}
  };

  const isGifUrl = (text) => text && /\.(gif|webp)(\?.*)?$/i.test(text.trim()) && text.trim().startsWith('http');

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

  const openProfilePanel = async (userId) => {
    try {
      const [userData, contactCheck] = await Promise.all([
        api.get(`/users/${userId}`, token),
        api.get(`/contacts/check/${userId}`, token)
      ]);
      const stats = { photos: 0, videos: 0, files: 0, links: 0, voice: 0 };
      messages.forEach(m => {
        if (m.file_url && m.file_type?.startsWith('image/')) stats.photos++;
        else if (m.file_url && m.file_type?.startsWith('video/')) stats.videos++;
        else if (m.file_url && m.file_type?.startsWith('audio/')) stats.voice++;
        else if (m.file_url) stats.files++;
        if (m.text && /https?:\/\/\S+/.test(m.text)) stats.links++;
      });
      setProfilePanel({ ...userData, stats, isContact: contactCheck.isContact });
    } catch {
      // ignore
    }
  };

  const toggleContact = async (userId) => {
    if (!profilePanel) return;
    if (profilePanel.isContact) {
      await api.delete(`/contacts/${userId}`, token);
      setProfilePanel({ ...profilePanel, isContact: false });
    } else {
      await api.post(`/contacts/${userId}`, {}, token);
      setProfilePanel({ ...profilePanel, isContact: true });
    }
  };

  const isImage = (type) => type && type.startsWith('image/');
  const isVideo = (type) => type && type.startsWith('video/');

  const getChatAvatar = (chat, size = 50) => {
    if (chat.type === 'group') {
      return <GroupAvatar size={size} name={chat.name} />;
    }
    const otherUser = chat.members?.find(m => m.id !== user.id);
    if (otherUser) {
      return <UserAvatar user={otherUser} size={size} />;
    }
    return <UserAvatar user={{ id: chat.id, full_name: chat.name }} size={size} />;
  };

  // Group messages by date
  const renderMessages = () => {
    const elements = [];
    let lastDate = '';
    messages.forEach((msg, i) => {
      const msgDate = getDateLabel(msg.created_at);
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        elements.push(
          <div key={`date-${i}`} className="date-separator">
            <span>{msgDate}</span>
          </div>
        );
      }

      const senderUser = users.find(u => u.id === msg.sender_id);
      const senderColor = getSenderColor(msg.sender_id);

      elements.push(
        <div key={msg.id} className={`message ${msg.sender_id === user.id ? 'own' : ''}`}>
          {msg.sender_id !== user.id && currentChat?.type === 'group' && (
            <div className="message-sender" style={{ color: senderColor }}>{msg.sender_name}</div>
          )}
          {msg.reply_to && (
            <div className="message-reply">
              <span className="reply-author">{msg.reply_sender_name}</span>
              <span className="reply-text">{msg.reply_text}</span>
            </div>
          )}
          {msg.file_url && isImage(msg.file_type) && (
            <div className="message-image-wrap">
              <img src={msg.file_url} alt={msg.file_name} className="message-image" />
              <a href={msg.file_url} download={msg.file_name} className="message-image-download" title="Скачать">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </a>
            </div>
          )}
          {msg.file_url && isVideo(msg.file_type) && !msg.file_name?.startsWith('videonote_') && (
            <div className="message-image-wrap">
              <video src={msg.file_url} controls className="message-video" />
              <a href={msg.file_url} download={msg.file_name} className="message-image-download" title="Скачать">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </a>
            </div>
          )}
          {msg.file_url && msg.file_type?.startsWith('audio/') && (
            <div className="message-voice">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
              <audio src={msg.file_url} controls preload="metadata" />
            </div>
          )}
          {msg.file_url && msg.file_type?.startsWith('video/') && msg.file_name?.startsWith('videonote_') && (
            <div className="message-videonote">
              <video src={msg.file_url} controls className="videonote-player" />
            </div>
          )}
          {msg.file_url && !isImage(msg.file_type) && !isVideo(msg.file_type) && !msg.file_type?.startsWith('audio/') && (
            <a href={msg.file_url} download={msg.file_name} className="message-file">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span className="message-file-name">{msg.file_name}</span>
            </a>
          )}
          {msg.text && (isGifUrl(msg.text) ? (
            <img src={msg.text.trim()} alt="GIF" className="message-gif" />
          ) : (
            <div className="message-text">{msg.text}</div>
          ))}
          <div className="message-meta">
            <span className="message-time">{formatTime(msg.created_at)}</span>
            {msg.sender_id === user.id && (
              <span className={`message-status ${msg.is_read ? 'read' : ''}`}>
                {msg.is_read ? (
                  <svg viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 5.5 4.5 9 4.5 9"/><polyline points="4 5.5 7.5 9 15 1"/><polyline points="11 1 7.5 5"/></svg>
                ) : (
                  <svg viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 5.5 5.5 9.5 14.5 1"/></svg>
                )}
              </span>
            )}
          </div>
          <div className="message-actions">
            <button onClick={() => setReplyTo(msg)} title="Ответить">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
            </button>
            {(msg.sender_id === user.id || user.role === 'admin') && (
              <button onClick={() => deleteMessage(msg.id)} title="Удалить">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        </div>
      );
    });
    return elements;
  };

  return (
    <div className="chats-page">
      <div className={`chat-list-panel ${chatId ? 'mobile-hidden' : ''}`}>
        <div className="chat-list-header">
          <h2>Чаты</h2>
          <div className="chat-list-actions">
            <button className="icon-btn" onClick={() => setShowNewChat(true)} title="Новый чат">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button className="icon-btn" onClick={() => setShowNewGroup(true)} title="Новая группа">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </button>
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
              {getChatAvatar(chat, 50)}
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

      <div className={`chat-area ${!chatId ? 'mobile-hidden' : ''}`}>
        {chatId && currentChat ? (
          <>
            <div className="chat-header">
              <button className="back-btn mobile-only" onClick={() => navigate('/chats')}>{'\u2190'}</button>
              <div className="chat-header-clickable" onClick={() => {
                if (currentChat.type === 'group') return;
                const other = currentChat.members?.find(m => m.id !== user.id);
                if (other) openProfilePanel(other.id);
              }} style={{ cursor: currentChat.type !== 'group' ? 'pointer' : 'default' }}>
                {getChatAvatar(currentChat, 42)}
                <div className="chat-header-info">
                  <div className="chat-header-name">{currentChat.name}</div>
                  <div className="chat-header-status">
                    {Object.keys(typing).length > 0 ? (
                      <span className="typing-indicator">печатает...</span>
                    ) : currentChat.type === 'group' ?
                      `${currentChat.members?.length || 0} участников` :
                      currentChat.members?.find(m => m.id !== user.id)?.status === 'online' ? 'в сети' : 'не в сети'
                    }
                  </div>
                </div>
              </div>
            </div>

            <div className="messages-area">
              {renderMessages()}
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-area">
              {replyTo && (
                <div className="reply-preview">
                  <span>Ответ для {replyTo.sender_name}: {replyTo.text?.slice(0, 50)}</span>
                  <button onClick={() => setReplyTo(null)}>{'\u2715'}</button>
                </div>
              )}
              {isRecording ? (
                <div className="message-input-row recording">
                  <button className="icon-btn recording-cancel" onClick={cancelVoiceRecording} title="Отмена">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                  <div className="recording-indicator">
                    <span className="recording-dot" />
                    <span className="recording-time">{formatRecTime(recordingTime)}</span>
                  </div>
                  <button className="send-btn" onClick={stopVoiceRecording} title="Отправить">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                </div>
              ) : (
                <div className="message-input-row">
                  <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Файл">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden />
                  <button className="icon-btn" onClick={() => { setShowChatEmoji(!showChatEmoji); setShowChatGif(false); }} title="Эмодзи">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </button>
                  <input
                    type="text"
                    placeholder="Сообщение..."
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  />
                  {messageText.trim() ? (
                    <button className="send-btn" onClick={sendMessage} title="Отправить">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                  ) : (
                    <>
                      <button className="icon-btn" onClick={() => { openChatGifPicker(); setShowChatEmoji(false); }} title="GIF">
                        <span style={{fontWeight: 700, fontSize: 12}}>GIF</span>
                      </button>
                      <button className="icon-btn" onClick={startVideoNote} title="Видеосообщение">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                      </button>
                      <button className="icon-btn" onClick={startVoiceRecording} title="Голосовое сообщение">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                      </button>
                    </>
                  )}
                </div>
                {showChatEmoji && (
                  <div className="emoji-picker">
                    {EMOJI_LIST.map(e => (
                      <button key={e} className="emoji-item" onClick={() => { setMessageText(prev => prev + e); }}>{e}</button>
                    ))}
                  </div>
                )}
              )}
            </div>

            {showVideoNote && (
              <div className="videonote-overlay" onClick={closeVideoNote}>
                <div className="videonote-recorder" onClick={e => e.stopPropagation()}>
                  <video ref={videoPreviewRef} muted className="videonote-preview" />
                  <div className="videonote-controls">
                    {isRecordingVideo ? (
                      <>
                        <span className="recording-dot" />
                        <span className="recording-time">{formatRecTime(videoRecordingTime)}</span>
                        <button className="btn primary" onClick={stopVideoRecording}>Отправить</button>
                      </>
                    ) : (
                      <button className="btn primary" onClick={startVideoRecording}>Записать</button>
                    )}
                    <button className="btn secondary" onClick={closeVideoNote}>Отмена</button>
                  </div>
                </div>
              </div>
            )}

            {showChatGif && (
              <div className="gif-picker-overlay" onClick={() => setShowChatGif(false)}>
                <div className="gif-picker" onClick={e => e.stopPropagation()}>
                  <div className="gif-picker-header">
                    <input
                      type="text"
                      placeholder="Поиск GIF..."
                      value={chatGifSearch}
                      onChange={e => searchChatGifs(e.target.value)}
                      autoFocus
                    />
                    <button className="icon-btn" onClick={() => setShowChatGif(false)}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div className="gif-picker-grid">
                    {chatGifLoading && <div className="gif-loading">Загрузка...</div>}
                    {chatGifs.map(g => (
                      <img key={g.id} src={g.preview || g.url} alt={g.title} onClick={() => selectChatGif(g)} className="gif-item" />
                    ))}
                    {!chatGifLoading && chatGifs.length === 0 && <div className="gif-loading">Ничего не найдено</div>}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="no-chat-selected">
            <img src="/logo.png" alt="ПРМ" style={{ width: 100, opacity: 0.3 }} />
            <p>Выберите чат для начала общения</p>
          </div>
        )}
      </div>

      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Новый чат</h3>
            <div className="user-list">
              {users.filter(u => u.id !== user.id).map(u => (
                <div key={u.id} className="user-list-item" onClick={() => createPrivateChat(u.id)}>
                  <UserAvatar user={u} size={40} />
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
                  <UserAvatar user={u} size={36} />
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

      {profilePanel && (
        <div className="profile-panel-overlay" onClick={() => setProfilePanel(null)}>
          <div className="profile-panel" onClick={e => e.stopPropagation()}>
            <button className="profile-panel-close" onClick={() => setProfilePanel(null)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <div className="profile-panel-header">
              <UserAvatar user={profilePanel} size={90} />
              <div className="profile-panel-name">{profilePanel.full_name}</div>
              <div className="profile-panel-status">
                {profilePanel.status === 'online' ? 'в сети' : 'был(а) недавно'}
              </div>
            </div>

            <div className="profile-panel-actions">
              <button className="profile-panel-action" onClick={() => { setProfilePanel(null); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Чат</span>
              </button>
              <button className={`profile-panel-action ${profilePanel.isContact ? 'active' : ''}`} onClick={() => toggleContact(profilePanel.id)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {profilePanel.isContact ? (
                    <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></>
                  ) : (
                    <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></>
                  )}
                </svg>
                <span>{profilePanel.isContact ? 'В контактах' : 'Добавить'}</span>
              </button>
              <button className="profile-panel-action">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                <span>Ещё</span>
              </button>
            </div>

            <div className="profile-panel-info">
              {profilePanel.username && (
                <div className="profile-panel-row">
                  <span className="profile-panel-value" style={{ color: 'var(--accent)' }}>@{profilePanel.username}</span>
                  <span className="profile-panel-label">Имя пользователя</span>
                </div>
              )}
              {profilePanel.position && (
                <div className="profile-panel-row">
                  <span className="profile-panel-value">{profilePanel.position}</span>
                  <span className="profile-panel-label">Должность</span>
                </div>
              )}
              {profilePanel.department && (
                <div className="profile-panel-row">
                  <span className="profile-panel-value">{profilePanel.department}</span>
                  <span className="profile-panel-label">Отдел</span>
                </div>
              )}
              {profilePanel.bio && (
                <div className="profile-panel-row">
                  <span className="profile-panel-value">{profilePanel.bio}</span>
                  <span className="profile-panel-label">О себе</span>
                </div>
              )}
            </div>

            <div className="profile-panel-media">
              {profilePanel.stats.photos > 0 && (
                <div className="profile-panel-media-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>{profilePanel.stats.photos} фотографий</span>
                </div>
              )}
              {profilePanel.stats.videos > 0 && (
                <div className="profile-panel-media-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  <span>{profilePanel.stats.videos} видео</span>
                </div>
              )}
              {profilePanel.stats.files > 0 && (
                <div className="profile-panel-media-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>{profilePanel.stats.files} файлов</span>
                </div>
              )}
              {profilePanel.stats.links > 0 && (
                <div className="profile-panel-media-row">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  <span>{profilePanel.stats.links} ссылок</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SENDER_COLORS = [
  '#e17076', '#eda86c', '#a695e7', '#7bc862',
  '#6ec9cb', '#65aadd', '#ee7aae', '#e0a060',
];

function getSenderColor(id) {
  return SENDER_COLORS[(id || 0) % SENDER_COLORS.length];
}
