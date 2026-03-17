import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, uploadFile } from '../utils/api';
import { formatTime, getInitials } from '../utils/format';

export default function BlogPage() {
  const { user, token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [commentTexts, setCommentTexts] = useState({});

  useEffect(() => {
    loadPosts();
  }, [token]);

  const loadPosts = () => api.get('/blog', token).then(setPosts).catch(() => {});

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview({ url, type: file.type.startsWith('video') ? 'video' : 'image' });
  };

  const createPost = async () => {
    if (!newPostText.trim() && !mediaFile) return;
    setPosting(true);
    try {
      let media_url = '', media_type = '';
      if (mediaFile) {
        const uploaded = await uploadFile(mediaFile, token);
        media_url = uploaded.url;
        media_type = mediaFile.type.startsWith('video') ? 'video' : 'image';
      }
      const post = await api.post('/blog', { text: newPostText, media_url, media_type }, token);
      setPosts([post, ...posts]);
      setNewPostText('');
      setMediaFile(null);
      setMediaPreview(null);
    } catch (err) {
      alert('Ошибка создания поста');
    }
    setPosting(false);
  };

  const toggleLike = async (postId) => {
    const result = await api.post(`/blog/${postId}/like`, {}, token);
    setPosts(posts.map(p => p.id === postId ? { ...p, likes_count: result.count, is_liked: result.liked ? 1 : 0 } : p));
  };

  const toggleComments = async (postId) => {
    if (expandedComments[postId]) {
      setExpandedComments({ ...expandedComments, [postId]: false });
      return;
    }
    const data = await api.get(`/blog/${postId}/comments`, token);
    setComments({ ...comments, [postId]: data });
    setExpandedComments({ ...expandedComments, [postId]: true });
  };

  const addComment = async (postId) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;
    const comment = await api.post(`/blog/${postId}/comments`, { text }, token);
    setComments({ ...comments, [postId]: [...(comments[postId] || []), comment] });
    setCommentTexts({ ...commentTexts, [postId]: '' });
    setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
  };

  const deletePost = async (postId) => {
    if (!confirm('Удалить пост?')) return;
    await api.delete(`/blog/${postId}`, token);
    setPosts(posts.filter(p => p.id !== postId));
  };

  return (
    <div className="blog-page">
      <div className="blog-container">
        {/* New post form */}
        <div className="blog-new-post">
          <div className="blog-new-post-header">
            <div className="avatar small">{getInitials(user.full_name)}</div>
            <textarea
              placeholder="Что нового?"
              value={newPostText}
              onChange={e => setNewPostText(e.target.value)}
              rows={3}
            />
          </div>
          {mediaPreview && (
            <div className="media-preview">
              {mediaPreview.type === 'image' ?
                <img src={mediaPreview.url} alt="preview" /> :
                <video src={mediaPreview.url} controls />
              }
              <button className="remove-media" onClick={() => { setMediaFile(null); setMediaPreview(null); }}>✕</button>
            </div>
          )}
          <div className="blog-new-post-actions">
            <label className="icon-btn">
              🖼️ Фото
              <input type="file" accept="image/*" onChange={handleMediaSelect} hidden />
            </label>
            <label className="icon-btn">
              🎬 Видео
              <input type="file" accept="video/*" onChange={handleMediaSelect} hidden />
            </label>
            <button className="btn primary" onClick={createPost} disabled={posting}>
              {posting ? 'Публикация...' : 'Опубликовать'}
            </button>
          </div>
        </div>

        {/* Posts feed */}
        {posts.map(post => (
          <div key={post.id} className="blog-post">
            <div className="blog-post-header">
              <div className="avatar small">{getInitials(post.author_name)}</div>
              <div className="blog-post-author">
                <div className="blog-post-author-name">{post.author_name}</div>
                <div className="blog-post-author-pos">{post.author_position}</div>
              </div>
              <span className="blog-post-time">{formatTime(post.created_at)}</span>
              {(post.author_id === user.id || user.role === 'admin') && (
                <button className="icon-btn small" onClick={() => deletePost(post.id)}>🗑</button>
              )}
            </div>

            {post.text && <div className="blog-post-text">{post.text}</div>}

            {post.media_url && post.media_type === 'image' && (
              <img src={post.media_url} alt="" className="blog-post-media" />
            )}
            {post.media_url && post.media_type === 'video' && (
              <video src={post.media_url} controls className="blog-post-media" />
            )}

            <div className="blog-post-stats">
              <button className={`like-btn ${post.is_liked ? 'liked' : ''}`} onClick={() => toggleLike(post.id)}>
                {post.is_liked ? '❤️' : '🤍'} {post.likes_count || 0}
              </button>
              <button className="comment-btn" onClick={() => toggleComments(post.id)}>
                💬 {post.comments_count || 0}
              </button>
            </div>

            {expandedComments[post.id] && (
              <div className="blog-comments">
                {(comments[post.id] || []).map(c => (
                  <div key={c.id} className="blog-comment">
                    <div className="avatar tiny">{getInitials(c.author_name)}</div>
                    <div className="blog-comment-content">
                      <span className="blog-comment-author">{c.author_name}</span>
                      <span className="blog-comment-text">{c.text}</span>
                      <span className="blog-comment-time">{formatTime(c.created_at)}</span>
                    </div>
                  </div>
                ))}
                <div className="blog-comment-input">
                  <input
                    type="text"
                    placeholder="Комментарий..."
                    value={commentTexts[post.id] || ''}
                    onChange={e => setCommentTexts({ ...commentTexts, [post.id]: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && addComment(post.id)}
                  />
                  <button className="send-btn" onClick={() => addComment(post.id)}>➤</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
