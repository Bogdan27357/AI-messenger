import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, getWsUrl } from '../utils/api';
import UserAvatar from './UserAvatar';
import AIChat from './AIChat';

export default function MainLayout({ children }) {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [ws, setWs] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(getWsUrl());
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'notification') {
          setUnreadNotifs(prev => prev + 1);
        }
        window.dispatchEvent(new CustomEvent('ws-message', { detail: data }));
      } catch {}
    };
    setWs(socket);
    return () => socket.close();
  }, [token]);

  useEffect(() => {
    api.get('/notifications/unread-count', token).then(d => setUnreadNotifs(d.count)).catch(() => {});
  }, [token, location.pathname]);

  const navItems = [
    { path: '/chats', icon: '\u{1F4AC}', label: 'Чаты' },
    { path: '/blog', icon: '\u{1F4F0}', label: 'Блог' },
    { path: '/notifications', icon: '\u{1F514}', label: 'Уведомления', badge: unreadNotifs },
    { path: '/profile', icon: '\u{1F464}', label: 'Профиль' },
  ];

  if (user.role === 'admin') {
    navItems.splice(3, 0, { path: '/admin', icon: '\u2699\uFE0F', label: 'Админ' });
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="ПРМ" className="sidebar-logo" onClick={() => navigate('/chats')} />
        </div>
        <div className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
            <UserAvatar user={user} size={36} />
          </div>
          <button className="logout-btn" onClick={logout} title="Выйти">
            &#x2190;
          </button>
        </div>
      </nav>
      <main className="main-content">{children}</main>

      <button className="ai-fab" onClick={() => setShowAIChat(!showAIChat)} title="ИИ-ассистент">
        {'\u{1F916}'}
      </button>
      {showAIChat && <AIChat onClose={() => setShowAIChat(false)} />}
    </div>
  );
}
