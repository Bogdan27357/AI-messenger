import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import ChatsPage from './pages/ChatsPage';
import BlogPage from './pages/BlogPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import TestTakePage from './pages/TestTakePage';
import NotificationsPage from './pages/NotificationsPage';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <img src="/logo.png" alt="ПРМ" className="loading-logo" />
        <div className="loading-text">Загрузка...</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/chats" />} />
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/chats/:chatId" element={<ChatsPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/tests/:testId" element={<TestTakePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Routes>
    </MainLayout>
  );
}
