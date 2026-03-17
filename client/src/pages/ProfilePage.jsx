import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, uploadFile } from '../utils/api';
import { getInitials, formatDate } from '../utils/format';

export default function ProfilePage() {
  const { userId } = useParams();
  const { user, token, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [posts, setPosts] = useState([]);
  const [myTests, setMyTests] = useState([]);
  const [myTrainings, setMyTrainings] = useState([]);
  const [tab, setTab] = useState('posts');

  const viewUserId = userId ? parseInt(userId) : user.id;
  const isOwn = viewUserId === user.id;

  useEffect(() => {
    api.get(`/users/${viewUserId}`, token).then(p => {
      setProfile(p);
      setForm({ full_name: p.full_name, position: p.position, bio: p.bio });
    }).catch(() => {});
    api.get(`/blog/user/${viewUserId}`, token).then(setPosts).catch(() => {});
    if (isOwn) {
      api.get('/admin/my-tests', token).then(setMyTests).catch(() => {});
      api.get('/admin/my-trainings', token).then(setMyTrainings).catch(() => {});
    }
  }, [viewUserId, token]);

  const saveProfile = async () => {
    const updated = await api.put('/users/profile', form, token);
    setProfile({ ...profile, ...updated });
    updateUser(updated);
    setEditing(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploaded = await uploadFile(file, token);
    const updated = await api.put('/users/profile', { avatar: uploaded.url }, token);
    setProfile({ ...profile, ...updated });
    updateUser(updated);
  };

  if (!profile) return <div className="loading-text">Загрузка...</div>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar-wrapper">
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="profile-avatar" />
          ) : (
            <div className="avatar large">{getInitials(profile.full_name)}</div>
          )}
          {isOwn && (
            <label className="avatar-upload-btn">
              📷
              <input type="file" accept="image/*" onChange={handleAvatarChange} hidden />
            </label>
          )}
        </div>
        <div className="profile-info">
          {editing ? (
            <div className="profile-edit-form">
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="ФИО" />
              <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} placeholder="Должность" />
              <textarea value={form.bio || ''} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="О себе" />
              <div className="profile-edit-actions">
                <button className="btn primary" onClick={saveProfile}>Сохранить</button>
                <button className="btn secondary" onClick={() => setEditing(false)}>Отмена</button>
              </div>
            </div>
          ) : (
            <>
              <h2>{profile.full_name}</h2>
              <p className="profile-position">{profile.position}</p>
              <p className="profile-department">{profile.department}</p>
              {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              {profile.mentor && (
                <p className="profile-mentor">Наставник: {profile.mentor.full_name}</p>
              )}
              <p className="profile-joined">В системе с {formatDate(profile.created_at)}</p>
              {isOwn && <button className="btn secondary" onClick={() => setEditing(true)}>Редактировать</button>}
            </>
          )}
        </div>
      </div>

      <div className="profile-tabs">
        <button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>Посты</button>
        {isOwn && <button className={tab === 'tests' ? 'active' : ''} onClick={() => setTab('tests')}>Мои тесты</button>}
        {isOwn && <button className={tab === 'trainings' ? 'active' : ''} onClick={() => setTab('trainings')}>Обучения</button>}
      </div>

      <div className="profile-content">
        {tab === 'posts' && (
          <div className="profile-posts">
            {posts.length === 0 && <p className="empty-text">Нет публикаций</p>}
            {posts.map(post => (
              <div key={post.id} className="blog-post">
                {post.text && <div className="blog-post-text">{post.text}</div>}
                {post.media_url && post.media_type === 'image' && <img src={post.media_url} className="blog-post-media" alt="" />}
                {post.media_url && post.media_type === 'video' && <video src={post.media_url} controls className="blog-post-media" />}
                <div className="blog-post-stats">
                  <span>❤️ {post.likes_count}</span>
                  <span>💬 {post.comments_count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'tests' && (
          <div className="profile-tests">
            {myTests.length === 0 && <p className="empty-text">Нет назначенных тестов</p>}
            {myTests.map(t => (
              <div key={t.id} className="test-card">
                <h4>{t.title}</h4>
                <p>{t.description}</p>
                <div className="test-card-info">
                  <span>Вопросов: {t.questions_count}</span>
                  <span className={`test-status ${t.status}`}>
                    {t.status === 'completed' ? `Результат: ${t.score}%` : 'Назначен'}
                  </span>
                </div>
                {t.status !== 'completed' && (
                  <a href={`/tests/${t.test_id}`} className="btn primary small">Пройти тест</a>
                )}
              </div>
            ))}
          </div>
        )}
        {tab === 'trainings' && (
          <div className="profile-trainings">
            {myTrainings.length === 0 && <p className="empty-text">Нет назначенных обучений</p>}
            {myTrainings.map(t => (
              <div key={t.id} className="training-card">
                <h4>{t.title}</h4>
                <p>{t.description}</p>
                <div className="training-card-info">
                  {t.start_date && <span>📅 {formatDate(t.start_date)}</span>}
                  {t.location && <span>📍 {t.location}</span>}
                  <span className={`training-status ${t.status}`}>
                    {t.status === 'completed' ? 'Пройдено' : 'Назначено'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
