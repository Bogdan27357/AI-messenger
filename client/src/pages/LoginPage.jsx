import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', position: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(form.username, form.password, form.full_name, form.position);
      } else {
        await login(form.username, form.password);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/logo.png" alt="ПРМ" className="login-logo" />
        <h1 className="login-title">ПРМ</h1>
        <p className="login-subtitle">Корпоративный мессенджер<br/>Отдел дополнительного обслуживания<br/>Аэропорт Пулково</p>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            placeholder="Логин"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
          />
          {isRegister && (
            <>
              <input
                type="text"
                placeholder="ФИО"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Должность"
                value={form.position}
                onChange={e => setForm({ ...form, position: e.target.value })}
              />
            </>
          )}
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? 'Загрузка...' : (isRegister ? 'Зарегистрироваться' : 'Войти')}
          </button>
        </form>

        <button className="link-btn" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
          {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
        </button>

        <div className="login-hint">
          <small>Демо: admin / admin123</small>
        </div>
      </div>
    </div>
  );
}
