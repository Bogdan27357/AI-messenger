import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { formatTime } from '../utils/format';

export default function NotificationsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.get('/notifications', token).then(setNotifications).catch(() => {});
    api.put('/notifications/read-all', {}, token).catch(() => {});
  }, [token]);

  const typeIcons = {
    mentor: '👨‍🏫',
    test: '📝',
    training: '🎓',
    message: '💬',
  };

  return (
    <div className="notifications-page">
      <h2>Уведомления</h2>
      <div className="notifications-list">
        {notifications.length === 0 && <p className="empty-text">Нет уведомлений</p>}
        {notifications.map(n => (
          <div
            key={n.id}
            className={`notification-item ${n.is_read ? '' : 'unread'}`}
            onClick={() => n.link && navigate(n.link)}
          >
            <span className="notification-icon">{typeIcons[n.type] || '🔔'}</span>
            <div className="notification-content">
              <div className="notification-title">{n.title}</div>
              <div className="notification-message">{n.message}</div>
              <div className="notification-time">{formatTime(n.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
