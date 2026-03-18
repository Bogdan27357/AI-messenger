import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, getWsUrl } from '../utils/api';
import UserAvatar from './UserAvatar';
import AIChat from './AIChat';

const Icons = {
  chats: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  blog: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
    </svg>
  ),
  notifications: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  admin: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  profile: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

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
    window.__ws = socket;
    return () => { socket.close(); window.__ws = null; };
  }, [token]);

  useEffect(() => {
    api.get('/notifications/unread-count', token).then(d => setUnreadNotifs(d.count)).catch(() => {});
  }, [token, location.pathname]);

  const navItems = [
    { path: '/chats', icon: Icons.chats, label: 'Чаты' },
    { path: '/blog', icon: Icons.blog, label: 'Блог' },
    { path: '/notifications', icon: Icons.notifications, label: 'Уведомления', badge: unreadNotifs },
    { path: '/profile', icon: Icons.profile, label: 'Профиль' },
  ];

  if (user.role === 'admin') {
    navItems.splice(3, 0, { path: '/admin', icon: Icons.admin, label: 'Управление' });
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-profile" onClick={() => navigate('/profile')}>
          <UserAvatar user={user} size={38} />
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">{user.full_name}</div>
            <div className="sidebar-profile-role">{user.position || 'Сотрудник'}</div>
          </div>
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
          <button className="nav-item logout-item" onClick={logout}>
            <span className="nav-icon">{Icons.logout}</span>
            <span className="nav-label">Выйти</span>
          </button>
        </div>
      </nav>
      <main className="main-content">{children}</main>

      <button className="ai-fab" onClick={() => setShowAIChat(!showAIChat)} title="ИИ-ассистент">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.07A7 7 0 0 1 14 22h-4a7 7 0 0 1-6.93-6H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zm-4 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
        </svg>
      </button>
      {showAIChat && <AIChat onClose={() => setShowAIChat(false)} />}
    </div>
  );
}
