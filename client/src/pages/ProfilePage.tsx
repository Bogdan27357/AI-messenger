import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';
import Avatar from '../components/User/Avatar';
import { ArrowLeft, Camera, Save } from 'lucide-react';

export default function ProfilePage() {
  const { user, loadUser } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.name || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      await api.post(`/users/${user.id}/avatar?type=avatars`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadUser();
    } catch (error) {
      console.error('Avatar upload error:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await api.put(`/users/${user.id}`, { name, displayName });
      await loadUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen bg-dark-900 flex flex-col">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-dark-700 bg-dark-800">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-dark-700 rounded-lg">
          <ArrowLeft size={20} className="text-dark-300" />
        </button>
        <h1 className="text-xl font-bold text-white">Профиль</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <Avatar src={user?.avatar} name={user?.name || ''} size="xl" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 hover:bg-primary-700 rounded-full flex items-center justify-center transition"
              >
                <Camera size={14} className="text-white" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
            <div className="text-sm text-dark-400 mt-3">{user?.email}</div>
            <div className="text-xs text-dark-500 mt-1">
              {user?.role === 'ADMIN' ? 'Администратор' : 'Пользователь'}
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-dark-300 text-sm mb-1.5">Имя</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500 transition"
              />
            </div>
            <div>
              <label className="block text-dark-300 text-sm mb-1.5">Отображаемое имя</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Необязательно"
                className="w-full bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500 transition"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-lg text-sm transition disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Сохранение...' : success ? 'Сохранено!' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
