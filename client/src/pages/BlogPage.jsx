import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, uploadFile } from '../utils/api';
import { formatTime } from '../utils/format';
import UserAvatar from '../components/UserAvatar';

const EMOJI_LIST = [
  '😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳',
  '😢','😭','😤','😡','🤯','😱','🥺','😴','🤔','🤗',
  '👍','👎','👏','🙌','🤝','💪','❤️','🔥','⭐','🎉',
  '💯','🙏','😈','💀','🤡','👀','💬','📸','🎵','🚀',
  '✅','❌','⚡','💎','🌟','🎯','💡','🏆','🎁','🌈',
];

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
  const [feedMode, setFeedMode] = useState('all');
  const [replyTo, setReplyTo] = useState({}); // { [postId]: { id, author_name } }
  const [showEmoji, setShowEmoji] = useState(null); // postId or 'new-post'
  const [showGif, setShowGif] = useState(null); // postId or 'new-post'
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifTimerRef = useRef(null);

  useEffect(() => {
    loadPosts();
  }, [token, feedMode]);

  const loadPosts = () => {
    const query = feedMode === 'contacts' ? '/blog?feed=contacts' : '/blog';
    api.get(query, token).then(setPosts).catch(() => {});
  };

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
    const reply = replyTo[postId];
    const comment = await api.post(`/blog/${postId}/comments`, { text, reply_to: reply?.id || null }, token);
    setComments({ ...comments, [postId]: [...(comments[postId] || []), comment] });
    setCommentTexts({ ...commentTexts, [postId]: '' });
    setReplyTo({ ...replyTo, [postId]: null });
    setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
  };

  const deletePost = async (postId) => {
    if (!confirm('Удалить пост?')) return;
    await api.delete(`/blog/${postId}`, token);
    setPosts(posts.filter(p => p.id !== postId));
  };

  // Emoji
  const insertEmoji = (emoji, target) => {
    if (target === 'new-post') {
      setNewPostText(prev => prev + emoji);
    } else {
      setCommentTexts(prev => ({ ...prev, [target]: (prev[target] || '') + emoji }));
    }
    setShowEmoji(null);
  };

  // GIF
  const openGifPicker = (target) => {
    setShowGif(target);
    setGifSearch('');
    setGifs([]);
    loadTrendingGifs();
  };

  const loadTrendingGifs = async () => {
    setGifLoading(true);
    try {
      const data = await api.get('/gif/trending?limit=20', token);
      setGifs(data.results || []);
    } catch { setGifs([]); }
    setGifLoading(false);
  };

  const searchGifs = (q) => {
    setGifSearch(q);
    clearTimeout(gifTimerRef.current);
    if (!q.trim()) { loadTrendingGifs(); return; }
    gifTimerRef.current = setTimeout(async () => {
      setGifLoading(true);
      try {
        const data = await api.get(`/gif/search?q=${encodeURIComponent(q)}&limit=20`, token);
        setGifs(data.results || []);
      } catch { setGifs([]); }
      setGifLoading(false);
    }, 400);
  };

  const selectGif = async (gif) => {
    const target = showGif;
    setShowGif(null);
    if (target === 'new-post') {
      setNewPostText(prev => prev + (prev ? '\n' : '') + gif.url);
      setMediaPreview({ url: gif.url, type: 'image' });
      // Create post with GIF as media
      setPosting(true);
      try {
        const post = await api.post('/blog', { text: newPostText, media_url: gif.url, media_type: 'image' }, token);
        setPosts([post, ...posts]);
        setNewPostText('');
        setMediaPreview(null);
      } catch {}
      setPosting(false);
    } else {
      // Send GIF as comment
      const postId = target;
      const reply = replyTo[postId];
      const comment = await api.post(`/blog/${postId}/comments`, { text: gif.url, reply_to: reply?.id || null }, token);
      setComments({ ...comments, [postId]: [...(comments[postId] || []), comment] });
      setReplyTo({ ...replyTo, [postId]: null });
      setPosts(posts.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
    }
  };

  const isGifUrl = (text) => text && /\.(gif|webp)(\?.*)?$/i.test(text.trim()) && text.trim().startsWith('http');

  const EmojiPicker = ({ target }) => (
    <div className="emoji-picker" onClick={e => e.stopPropagation()}>
      {EMOJI_LIST.map(e => (
        <button key={e} className="emoji-item" onClick={() => insertEmoji(e, target)}>{e}</button>
      ))}
    </div>
  );

  const GifPicker = () => (
    <div className="gif-picker-overlay" onClick={() => setShowGif(null)}>
      <div className="gif-picker" onClick={e => e.stopPropagation()}>
        <div className="gif-picker-header">
          <input
            type="text"
            placeholder="Поиск GIF..."
            value={gifSearch}
            onChange={e => searchGifs(e.target.value)}
            autoFocus
          />
          <button className="icon-btn" onClick={() => setShowGif(null)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="gif-picker-grid">
          {gifLoading && <div className="gif-loading">Загрузка...</div>}
          {gifs.map(g => (
            <img key={g.id} src={g.preview || g.url} alt={g.title} onClick={() => selectGif(g)} className="gif-item" />
          ))}
          {!gifLoading && gifs.length === 0 && <div className="gif-loading">Ничего не найдено</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="blog-page">
      <div className="blog-container">
        <div className="blog-feed-tabs">
          <button className={feedMode === 'all' ? 'active' : ''} onClick={() => setFeedMode('all')}>Все</button>
          <button className={feedMode === 'contacts' ? 'active' : ''} onClick={() => setFeedMode('contacts')}>Контакты</button>
        </div>
        <div className="blog-new-post">
          <div className="blog-new-post-header">
            <UserAvatar user={user} size={40} />
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
              <button className="remove-media" onClick={() => { setMediaFile(null); setMediaPreview(null); }}>{'\u2715'}</button>
            </div>
          )}
          <div className="blog-new-post-actions">
            <label className="icon-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span style={{marginLeft: 4}}>Фото</span>
              <input type="file" accept="image/*" onChange={handleMediaSelect} hidden />
            </label>
            <label className="icon-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              <span style={{marginLeft: 4}}>Видео</span>
              <input type="file" accept="video/*" onChange={handleMediaSelect} hidden />
            </label>
            <button className="icon-btn" onClick={() => setShowEmoji(showEmoji === 'new-post' ? null : 'new-post')} title="Эмодзи">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            <button className="icon-btn" onClick={() => openGifPicker('new-post')} title="GIF">
              <span style={{fontWeight: 700, fontSize: 13}}>GIF</span>
            </button>
            <button className="btn primary" onClick={createPost} disabled={posting}>
              {posting ? 'Публикация...' : 'Опубликовать'}
            </button>
          </div>
          {showEmoji === 'new-post' && <EmojiPicker target="new-post" />}
        </div>

        {posts.map(post => (
          <div key={post.id} className="blog-post">
            <div className="blog-post-header">
              <UserAvatar user={{ id: post.author_id, full_name: post.author_name, avatar: post.author_avatar }} size={42} />
              <div className="blog-post-author">
                <div className="blog-post-author-name">{post.author_name}</div>
                <div className="blog-post-author-pos">{post.author_position}</div>
              </div>
              <span className="blog-post-time">{formatTime(post.created_at)}</span>
              {(post.author_id === user.id || user.role === 'admin') && (
                <button className="icon-btn small" onClick={() => deletePost(post.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
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
                {post.is_liked ? '\u2764\uFE0F' : '\u{1F90D}'} {post.likes_count || 0}
              </button>
              <button className="comment-btn" onClick={() => toggleComments(post.id)}>
                {'\u{1F4AC}'} {post.comments_count || 0}
              </button>
            </div>

            {expandedComments[post.id] && (
              <div className="blog-comments">
                {(comments[post.id] || []).map(c => (
                  <div key={c.id} className="blog-comment">
                    <UserAvatar user={{ id: c.author_id, full_name: c.author_name, avatar: c.author_avatar }} size={28} />
                    <div className="blog-comment-content">
                      {c.reply_to && c.reply_author_name && (
                        <div className="blog-comment-reply-ref">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                          <span>{c.reply_author_name}</span>
                        </div>
                      )}
                      <span className="blog-comment-author">{c.author_name}</span>
                      {isGifUrl(c.text) ? (
                        <img src={c.text.trim()} alt="GIF" className="blog-comment-gif" />
                      ) : (
                        <span className="blog-comment-text">{c.text}</span>
                      )}
                      <div className="blog-comment-actions">
                        <span className="blog-comment-time">{formatTime(c.created_at)}</span>
                        <button className="blog-comment-reply-btn" onClick={() => setReplyTo({ ...replyTo, [post.id]: { id: c.id, author_name: c.author_name } })}>
                          Ответить
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {replyTo[post.id] && (
                  <div className="blog-comment-reply-preview">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    <span>Ответ для {replyTo[post.id].author_name}</span>
                    <button onClick={() => setReplyTo({ ...replyTo, [post.id]: null })}>{'\u2715'}</button>
                  </div>
                )}
                <div className="blog-comment-input">
                  <UserAvatar user={user} size={24} />
                  <input
                    type="text"
                    placeholder={replyTo[post.id] ? `Ответить ${replyTo[post.id].author_name}...` : 'Комментарий...'}
                    value={commentTexts[post.id] || ''}
                    onChange={e => setCommentTexts({ ...commentTexts, [post.id]: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && addComment(post.id)}
                  />
                  <button className="icon-btn tiny" onClick={() => setShowEmoji(showEmoji === post.id ? null : post.id)} title="Эмодзи">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </button>
                  <button className="icon-btn tiny" onClick={() => openGifPicker(post.id)} title="GIF">
                    <span style={{fontWeight: 700, fontSize: 11}}>GIF</span>
                  </button>
                  <button className="send-btn" onClick={() => addComment(post.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </button>
                </div>
                {showEmoji === post.id && <EmojiPicker target={post.id} />}
              </div>
            )}
          </div>
        ))}
      </div>
      {showGif !== null && <GifPicker />}
    </div>
  );
}
