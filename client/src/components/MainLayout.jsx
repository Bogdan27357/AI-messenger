import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, getWsUrl } from '../utils/api';
import { getInitials } from '../utils/format';
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
    { path: '/chats', icon: '💬', label: 'Чаты' },
    { path: '/blog', icon: '📰', label: 'Блог' },
    { path: '/notifications', icon: '🔔', label: 'Уведомления', badge: unreadNotifs },
    { path: '/profile', icon: '👤', label: 'Профиль' },
  ];

  if (user.role === 'admin') {
    navItems.splice(3, 0, { path: '/admin', icon: '⚙️', label: 'Админ' });
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="ПРМ" className="sidebar-logo" onClick={() => navigate('/chats')} />
          <span className="sidebar-title">ПРМ</span>
        </div>
        <div className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar small">{getInitials(user.full_name)}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.full_name}</div>
              <div className="sidebar-user-role">{user.position}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>Выйти</button>
        </div>
      </nav>
      <main className="main-content">{children}</main>

      {/* AI Chat FAB */}
      <button className="ai-fab" onClick={() => setShowAIChat(!showAIChat)} title="ИИ-ассистент">
        🤖
      </button>
      {showAIChat && <AIChat onClose={() => setShowAIChat(false)} />}
    </div>
  );
}
