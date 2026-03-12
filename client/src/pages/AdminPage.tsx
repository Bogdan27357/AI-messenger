import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Avatar from '../components/User/Avatar';
import type { User, KnowledgeDoc } from '../types';
import {
  ArrowLeft, Users, MessageCircle, UserPlus, Trash2, BarChart3,
  Upload, FileText, Bot, X,
} from 'lucide-react';

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'users' | 'stats' | 'knowledge'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeDoc[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'USER' });
  const [docForm, setDocForm] = useState({ title: '', content: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [tab]);

  async function loadData() {
    if (tab === 'users') {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } else if (tab === 'stats') {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } else if (tab === 'knowledge') {
      const { data } = await api.get('/ai/knowledge');
      setKnowledge(data);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setShowCreate(false);
      setForm({ email: '', name: '', password: '', role: 'USER' });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка');
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('Удалить пользователя?')) return;
    await api.delete(`/users/${id}`);
    loadData();
  }

  async function handleUploadDoc(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/ai/knowledge', docForm);
      setShowUpload(false);
      setDocForm({ title: '', content: '' });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка');
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);
    await api.post('/ai/knowledge', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    loadData();
  }

  async function handleDeleteDoc(id: string) {
    await api.delete(`/ai/knowledge/${id}`);
    loadData();
  }

  return (
    <div className="h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-dark-700 bg-dark-800">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-dark-700 rounded-lg">
          <ArrowLeft size={20} className="text-dark-300" />
        </button>
        <h1 className="text-xl font-bold text-white">Админ-панель</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-700 bg-dark-800 px-6">
        {[
          { key: 'users', label: 'Пользователи', icon: Users },
          { key: 'stats', label: 'Статистика', icon: BarChart3 },
          { key: 'knowledge', label: 'База знаний', icon: Bot },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition ${
              tab === t.key ? 'border-primary-500 text-primary-400' : 'border-transparent text-dark-400 hover:text-dark-200'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">Сотрудники ({users.length})</h2>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm transition"
              >
                <UserPlus size={16} /> Создать
              </button>
            </div>

            <div className="bg-dark-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left text-xs text-dark-400 font-medium px-4 py-3">Пользователь</th>
                    <th className="text-left text-xs text-dark-400 font-medium px-4 py-3">Email</th>
                    <th className="text-left text-xs text-dark-400 font-medium px-4 py-3">Роль</th>
                    <th className="text-left text-xs text-dark-400 font-medium px-4 py-3">Статус</th>
                    <th className="text-left text-xs text-dark-400 font-medium px-4 py-3">Сообщений</th>
                    <th className="text-right text-xs text-dark-400 font-medium px-4 py-3">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-dark-700/50 hover:bg-dark-700/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={u.avatar} name={u.name} size="sm" isOnline={u.isOnline} />
                          <span className="text-sm text-white">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-300">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${u.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' : 'bg-dark-600 text-dark-300'}`}>
                          {u.role === 'ADMIN' ? 'Админ' : 'Пользователь'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${u.isOnline ? 'text-green-400' : 'text-dark-400'}`}>
                          {u.isOnline ? 'Онлайн' : 'Офлайн'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-dark-300">{u._count?.sentMessages || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 hover:bg-red-500/10 rounded text-red-400 transition">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Create user modal */}
            {showCreate && (
              <div className="fixed inset-0 bg-dark-950/80 flex items-center justify-center z-50">
                <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-md mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Создать пользователя</h3>
                    <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-dark-700 rounded"><X size={20} className="text-dark-400" /></button>
                  </div>
                  {error && <div className="bg-red-500/10 text-red-400 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>}
                  <form onSubmit={handleCreateUser} className="space-y-3">
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Имя" required className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500" />
                    <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" required className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500" />
                    <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Пароль" type="password" required className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500" />
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500">
                      <option value="USER">Пользователь</option>
                      <option value="ADMIN">Администратор</option>
                    </select>
                    <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm transition">Создать</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'stats' && stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Всего пользователей', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
              { label: 'Онлайн', value: stats.onlineUsers, icon: Users, color: 'text-green-400' },
              { label: 'Чатов', value: stats.totalChats, icon: MessageCircle, color: 'text-purple-400' },
              { label: 'Сообщений', value: stats.totalMessages, icon: MessageCircle, color: 'text-orange-400' },
            ].map((s) => (
              <div key={s.label} className="bg-dark-800 rounded-xl p-6">
                <s.icon size={24} className={`${s.color} mb-3`} />
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-sm text-dark-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'knowledge' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">База знаний ({knowledge.length} док.)</h2>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-dark-200 px-4 py-2 rounded-lg text-sm transition cursor-pointer">
                  <Upload size={16} /> Загрузить файл
                  <input type="file" className="hidden" onChange={handleUploadFile} />
                </label>
                <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm transition">
                  <FileText size={16} /> Добавить текст
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {knowledge.map((doc) => (
                <div key={doc.id} className="bg-dark-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-primary-400" />
                    <div>
                      <div className="text-sm font-medium text-white">{doc.title}</div>
                      <div className="text-xs text-dark-400">
                        {doc.uploader?.name} • {new Date(doc.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteDoc(doc.id)} className="p-1.5 hover:bg-red-500/10 rounded text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add text document modal */}
            {showUpload && (
              <div className="fixed inset-0 bg-dark-950/80 flex items-center justify-center z-50">
                <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-lg mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">Добавить документ</h3>
                    <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-dark-700 rounded"><X size={20} className="text-dark-400" /></button>
                  </div>
                  <form onSubmit={handleUploadDoc} className="space-y-3">
                    <input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} placeholder="Название документа" required className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500" />
                    <textarea value={docForm.content} onChange={(e) => setDocForm({ ...docForm, content: e.target.value })} placeholder="Содержание документа..." rows={8} required className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-primary-500" />
                    <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm transition">Добавить</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
